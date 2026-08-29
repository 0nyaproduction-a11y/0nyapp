import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { authorizeMuxPlayback, type PlaybackTarget } from "@/lib/playback";
import { PerfCollector, runWithPerf, timePerf } from "@/lib/api/perf";

export const runtime = "nodejs";

type PlaybackRequestBody =
  | (PlaybackTarget & {
      guestCredential?: string;
      parentalSessionToken?: string;
      stillAtSeconds?: number;
    })
  | Record<string, never>;

function isPlaybackTarget(body: PlaybackRequestBody): body is PlaybackTarget {
  if (body.targetType === "SERIES_EPISODE") {
    return (
      typeof body.seriesSlug === "string" &&
      body.seriesSlug.trim() !== "" &&
      typeof body.episodeNumber === "number" &&
      Number.isInteger(body.episodeNumber) &&
      body.episodeNumber > 0
    );
  }

  if (body.targetType === "SHORT_FILM") {
    return typeof body.slug === "string" && body.slug.trim() !== "";
  }

  return false;
}

export async function POST(request: Request) {
  const collector = new PerfCollector();

  return runWithPerf(collector, async () => {
    const auth = await getApiAuth(request);

    if (auth.error) {
      const errRes = errorResponse("not_authenticated", "Authentication is required.", 401);
      return collector.applyHeaders(errRes);
    }

    let body: PlaybackRequestBody;

    try {
      body = await timePerf("body_parse", async () => (await request.json()) as PlaybackRequestBody);
    } catch {
      const errRes = errorResponse("invalid_request", "A valid JSON body is required.", 400);
      return collector.applyHeaders(errRes);
    }

    if (!isPlaybackTarget(body)) {
      const errRes = errorResponse("invalid_request", "A valid playback target is required.", 400);
      return collector.applyHeaders(errRes);
    }

    const result = await authorizeMuxPlayback(body, {
      guestCredential: typeof body.guestCredential === "string" ? body.guestCredential : null,
      parentalSessionToken:
        typeof body.parentalSessionToken === "string" ? body.parentalSessionToken : null,
      userId: auth.user?.id ?? null,
    }, typeof body.stillAtSeconds === "number" ? body.stillAtSeconds : null);

    if (result.status === "not_found") {
      const errRes = errorResponse("not_found", "Content not found.", 404);
      return collector.applyHeaders(errRes);
    }

    if (result.status !== "ok") {
      const res = dataResponse({ status: result.status });
      return collector.applyHeaders(res);
    }

    const res = await timePerf("serialize", async () =>
      dataResponse({
        expiresAt: result.expiresAt,
        playbackUrl: result.playbackUrl,
        ...(result.status === "ok" && result.stillUrl ? { stillUrl: result.stillUrl } : {}),
      })
    );

    return collector.applyHeaders(res);
  });
}
