import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  persistRankingDecisionEvidence,
  validateRankingDecisionSubmission,
} from "@/lib/ranking/decision-evidence";

export async function POST(request: Request) {
  const auth = await getApiAuth(request);
  if (auth.error) {
    return errorResponse("not_authenticated", "The supplied credential is invalid.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A JSON body is required.", 400);
  }

  const parsed = validateRankingDecisionSubmission(body);
  if (!parsed.ok) {
    return errorResponse("invalid_request", parsed.errors.join(" "), 400);
  }

  const result = await persistRankingDecisionEvidence(parsed.value, auth.user?.id ?? null);
  if (!result.recorded) {
    return errorResponse("server_error", "Unable to record ranking decision evidence.", 500);
  }

  return dataResponse({
    candidateSetId: parsed.value.candidateSetId,
    deduplicated: result.deduplicated,
    rankingDecisionId: parsed.value.rankingDecisionId,
    recorded: true,
  });
}
