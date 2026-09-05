import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { validateBehaviorEvent, BEHAVIOR_EVENT_SCHEMA_VERSION } from "@/lib/ranking/behavior-events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const auth = await getApiAuth(request);
  if (auth.error) return errorResponse("not_authenticated", "The supplied credential is invalid.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("invalid_request", "A JSON body is required.", 400); }
  const parsed = validateBehaviorEvent(body);
  if (!parsed.ok) return errorResponse("invalid_request", parsed.errors.join(" "), 400);
  const event = parsed.value;
  const { error } = await createAdminClient().from("ranking_behavior_events").insert({
    event_id: event.eventId,
    event_schema_version: BEHAVIOR_EVENT_SCHEMA_VERSION,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    actor_id: auth.user?.id ?? null,
    session_id: event.sessionId ?? null,
    content_id: event.contentId,
    content_type: event.contentType,
    source_surface: event.sourceSurface,
    row_id: event.rowId ?? null,
    position: event.position ?? null,
    search_query_context: event.searchQueryContext ?? null,
    search_result_position: event.searchResultPosition ?? null,
    metadata: (event.metadata ?? {}) as Json,
    ranking_decision_id: event.rankingDecisionId ?? null,
    recommendation_reason: event.recommendationReason ?? null,
    attribution_source: event.attributionSource ?? null,
    attribution_policy: event.attributionPolicy ?? null,
  });
  if (error?.code === "23505") return dataResponse({ recorded: true, deduplicated: true });
  if (error) return errorResponse("server_error", "Unable to record behavioral evidence.", 500);
  return dataResponse({ recorded: true, deduplicated: false });
}
