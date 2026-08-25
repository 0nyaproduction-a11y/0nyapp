import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { authorizeMuxPreviewPlayback, type PlaybackTarget } from "@/lib/playback";

export const runtime = "nodejs";

type PreviewPlaybackRequestBody =
  | (PlaybackTarget & {
      guestCredential?: string;
      parentalSessionToken?: string;
    })
  | Record<string, never>;

function isPreviewPlaybackTarget(body: PreviewPlaybackRequestBody): body is Extract<PlaybackTarget, { targetType: "SERIES_EPISODE" }> {
  return (
    body.targetType === "SERIES_EPISODE" &&
    typeof body.seriesSlug === "string" &&
    body.seriesSlug.trim() !== "" &&
    typeof body.episodeNumber === "number" &&
    Number.isInteger(body.episodeNumber) &&
    body.episodeNumber > 0
  );
}

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  if (auth.error) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: PreviewPlaybackRequestBody;

  try {
    body = (await request.json()) as PreviewPlaybackRequestBody;
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  if (!isPreviewPlaybackTarget(body)) {
    return errorResponse("invalid_request", "A valid episode target is required.", 400);
  }

  const result = await authorizeMuxPreviewPlayback(body, {
    guestCredential: typeof body.guestCredential === "string" ? body.guestCredential : null,
    parentalSessionToken:
      typeof body.parentalSessionToken === "string" ? body.parentalSessionToken : null,
    userId: auth.user?.id ?? null,
  });

  if (result.status === "not_found") {
    return errorResponse("not_found", "Content not found.", 404);
  }

  if (result.status !== "ok") {
    return dataResponse({ status: result.status });
  }

  return dataResponse({
    expiresAt: result.expiresAt,
    previewSeconds: result.previewSeconds,
    previewUrl: result.previewUrl,
  });
}
