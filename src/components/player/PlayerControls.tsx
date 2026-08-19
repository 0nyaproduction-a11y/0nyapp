"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type PlayerControlsProps = {
  isPlaying: boolean;
  isMuted: boolean;
  progress: number;
  currentTime: string;
  duration: string;
  backHref: string;
  nextHref?: string;
  onPlayToggle: () => void;
  onMuteToggle: () => void;
};

export function PlayerControls({
  isPlaying,
  isMuted,
  progress,
  currentTime,
  duration,
  backHref,
  nextHref,
  onPlayToggle,
  onMuteToggle,
}: PlayerControlsProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(3,5,4,0.86))] p-4">
      <div className="mb-3 h-[3px] bg-bone/16" aria-label={`${Math.round(progress)}% played`}>
        <div
          className="h-full bg-teal shadow-[0_0_12px_rgba(13,209,188,0.28)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="grid size-10 place-items-center border border-bone/10 bg-black/40 text-bone/74 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label="Back to series"
          >
            <Icon name="back" className="h-4.5 w-4.5" />
          </Link>
          <button
            type="button"
            onClick={onPlayToggle}
            className="grid size-11 place-items-center border border-teal/55 bg-teal text-black transition hover:bg-[#50e1d2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label={isPlaying ? "Pause episode" : "Play episode"}
          >
            <Icon
              name={isPlaying ? "pause" : "play"}
              className="h-4.5 w-4.5 fill-current"
            />
          </button>
        </div>
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-bone/70">
          {currentTime} / {duration}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMuteToggle}
            className="grid size-10 place-items-center border border-bone/10 bg-black/40 text-bone/74 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label={isMuted ? "Unmute episode" : "Mute episode"}
          >
            <Icon name={isMuted ? "mute" : "volume"} className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            className="grid size-10 place-items-center border border-bone/10 bg-black/40 text-bone/74 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            aria-label="Fullscreen"
          >
            <Icon name="fullscreen" className="h-4.5 w-4.5" />
          </button>
          {nextHref ? (
            <Link
              href={nextHref}
              className="hidden size-10 place-items-center border border-bone/10 bg-black/40 text-bone/74 transition hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:grid"
              aria-label="Next episode"
            >
              <Icon name="next" className="h-4.5 w-4.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
