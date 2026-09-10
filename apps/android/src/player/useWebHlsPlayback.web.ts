import Hls from "hls.js/dist/hls.js";
import { useEffect, useRef } from "react";
import type { WebHlsPlaybackOptions } from "./webHlsPlaybackTypes";

const VIDEO_ELEMENT_POLL_INTERVAL_MS = 50;
const VIDEO_ELEMENT_POLL_TIMEOUT_MS = 5000;
const MAX_RECOVERY_ATTEMPTS = 3;
const HLS_INSTANCE_KEY = "__onyaHls";

type HlsOwnedVideoElement = HTMLVideoElement & {
  [HLS_INSTANCE_KEY]?: { detach: () => void; uri: string };
};

/**
 * Chromium/Firefox cannot play HLS from a plain <video src>, and expo-video's web
 * implementation assigns the source URL directly. Mux assets in this project have no
 * static MP4 renditions, so the signed HLS manifest is the only authorized source.
 * This hook hands the already-authorized manifest to hls.js and attaches it to the
 * media element expo-video mounted. Safari keeps its native HLS path.
 */
export function useWebHlsPlayback({ uri, onError, onReady }: WebHlsPlaybackOptions) {
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  }, [onError, onReady]);

  useEffect(() => {
    if (!uri || !isHlsManifestUrl(uri)) {
      return;
    }

    let disposed = false;
    let hls: Hls | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollDeadline = Date.now() + VIDEO_ELEMENT_POLL_TIMEOUT_MS;
    let attachedVideo: HTMLVideoElement | null = null;
    let readySignalled = false;
    let restoreSrcOwnership: (() => void) | null = null;
    let ownsElement = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;

    const handleLoadedMetadata = () => {
      if (!attachedVideo || readySignalled) {
        return;
      }

      readySignalled = true;
      onReadyRef.current?.(Number.isFinite(attachedVideo.duration) ? attachedVideo.duration : 0);
    };

    const stopPolling = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const attach = (element: HTMLVideoElement) => {
      const video = element as HlsOwnedVideoElement;

      const existing = video[HLS_INSTANCE_KEY];
      if (existing) {
        if (existing.uri === uri) {
          // A previous effect pass (e.g. StrictMode double-invoke) already owns
          // this element with the same source; do not start a competing loader.
          attachedVideo = video;
          video.addEventListener("loadedmetadata", handleLoadedMetadata);
          ownsElement = false;
          return;
        }

        existing.detach();
      }

      attachedVideo = video;
      video.addEventListener("loadedmetadata", handleLoadedMetadata);

      // Chromium reports "maybe" for the HLS MIME type but cannot actually decode
      // it, so hls.js takes priority whenever it is supported. Safari (which has
      // real native HLS and no MSE-in-worker parity) keeps expo-video's own src.
      if (!Hls.isSupported()) {
        if (!video.canPlayType("application/vnd.apple.mpegurl")) {
          onErrorRef.current?.("This browser cannot play the requested stream.");
        }

        return;
      }

      // expo-video and React both assign the manifest URL to the element's src,
      // which clobbers the MediaSource blob hls.js attaches. Take ownership of the
      // src accessor while HLS drives the element, and hand it back on teardown.
      const nativeSetAttribute = video.setAttribute.bind(video);
      const nativeRemoveAttribute = video.removeAttribute.bind(video);
      const nativeLoad = video.load.bind(video);
      const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");

      restoreSrcOwnership = () => {
        video.setAttribute = nativeSetAttribute;
        video.removeAttribute = nativeRemoveAttribute;
        video.load = nativeLoad;
        delete (video as unknown as Record<string, unknown>).src;
      };

      video.setAttribute = (name: string, value: string) => {
        if (name === "src") {
          return;
        }

        nativeSetAttribute(name, value);
      };
      video.removeAttribute = (name: string) => {
        if (name === "src") {
          return;
        }

        nativeRemoveAttribute(name);
      };

      nativeRemoveAttribute("src");
      nativeLoad();

      // expo-video's web player re-runs its source sync on every render and calls
      // load(), which resets the MediaSource and aborts every in-flight segment.
      // hls.js owns the buffer once attached, so further load() calls are ignored.
      video.load = () => {};

      if (srcDescriptor?.get) {
        const readSrc = srcDescriptor.get.bind(video);
        const writeSrc = srcDescriptor.set?.bind(video);

        Object.defineProperty(video, "src", {
          configurable: true,
          get: readSrc,
          set: (value: string) => {
            // Only hls.js may point the element at its MediaSource blob.
            if (typeof value === "string" && value.startsWith("blob:")) {
              writeSrc?.(value);
            }
          },
        });
      }

      hls = new Hls({ enableWorker: true });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < MAX_RECOVERY_ATTEMPTS) {
          networkRecoveries += 1;
          hls?.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < MAX_RECOVERY_ATTEMPTS) {
          mediaRecoveries += 1;
          hls?.recoverMediaError();
          return;
        }

        // Recovery is bounded: an unsupported codec or a persistently failing
        // stream must surface as an error instead of endlessly re-buffering.
        hls?.destroy();
        hls = null;
        onErrorRef.current?.(
          data.type === Hls.ErrorTypes.MEDIA_ERROR
            ? "This browser can't play this video's audio or video format."
            : "Playback stream failed to load.",
        );
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => {
          // Autoplay may be blocked; the player UI controls playback in that case.
        });
      });
      hls.attachMedia(video);
      hls.loadSource(uri);

      ownsElement = true;
      video[HLS_INSTANCE_KEY] = { detach: () => detachOwnedElement(video), uri };
    };

    const detachOwnedElement = (video: HlsOwnedVideoElement) => {
      restoreSrcOwnership?.();
      restoreSrcOwnership = null;
      hls?.destroy();
      hls = null;
      delete video[HLS_INSTANCE_KEY];
    };

    const tryAttach = () => {
      if (disposed) {
        return;
      }

      const video = document.querySelector("video");
      if (video) {
        stopPolling();
        attach(video);
        return;
      }

      if (Date.now() > pollDeadline) {
        stopPolling();
      }
    };

    pollDeadline = Date.now() + VIDEO_ELEMENT_POLL_TIMEOUT_MS;
    tryAttach();
    if (!attachedVideo) {
      pollTimer = setInterval(tryAttach, VIDEO_ELEMENT_POLL_INTERVAL_MS);
    }

    return () => {
      disposed = true;
      stopPolling();
      attachedVideo?.removeEventListener("loadedmetadata", handleLoadedMetadata);

      if (ownsElement && attachedVideo) {
        detachOwnedElement(attachedVideo as HlsOwnedVideoElement);
      }

      attachedVideo = null;
      ownsElement = false;
    };
  }, [uri]);
}

function isHlsManifestUrl(value: string) {
  try {
    return new URL(value).pathname.endsWith(".m3u8");
  } catch {
    return value.includes(".m3u8");
  }
}
