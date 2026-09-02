import { dataResponse } from "@/lib/api/responses";
import { getPlayTogetherCommercialConfig } from "@/lib/play-together";

// PX01-C1: Public, read-only consumer visibility seam for Play Together.
//
// This endpoint exposes ONLY the consumer-facing activation gate (`enabled`).
// It is intentionally unauthenticated so that feature visibility can be
// resolved before a user completes any monetization/access action
// (docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md §36). The `enabled` flag itself is not
// secret; missing/private user state is never returned here.
//
// PI-D: The config endpoint now also exposes backend-controlled playback-sync
// tuning values (PX01-D) for the Android sync adapter and the ephemeral Host
// buffering signal. Like `enabled`, these are config/server-authoritative and
// never client-supplied; when the commercial config cannot be resolved the
// adapter reports disabled (sync serves nothing).
//
// Consumer visibility is server/config-authoritative and fail-closed: if the
// commercial config cannot be resolved, Play Together reports disabled so the
// feature is never surfaced. The client must never supply or override `enabled`.
export async function GET() {
  const config = await getPlayTogetherCommercialConfig();

  return dataResponse({
    enabled: config.ok ? config.data.enabled : false,
    sync: config.ok
      ? {
          heartbeatSeconds: config.data.sync.heartbeatSeconds,
          largeDriftCorrectionMs: config.data.sync.largeDriftMs,
          rateMaxFactor: config.data.sync.rateMaxFactor,
          rateMinFactor: config.data.sync.rateMinFactor,
          smallDriftIgnoredMs: config.data.sync.smallDriftMs,
        }
      : null,
  });
}
