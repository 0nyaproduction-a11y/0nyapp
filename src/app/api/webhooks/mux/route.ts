import { errorResponse } from "@/lib/api/responses";
import {
  processMuxWebhookEvent,
  verifyMuxWebhookSignature,
  type MuxWebhookEvent,
} from "@/lib/mux";

export const runtime = "nodejs";

function noStoreResponse(status = 204) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  const signingSecret = process.env.MUX_WEBHOOK_SIGNING_SECRET?.trim();

  if (!signingSecret) {
    return errorResponse("server_error", "Mux webhook signing secret is not configured.", 500);
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("mux-signature");
  const verification = verifyMuxWebhookSignature(rawBody, signatureHeader, signingSecret);

  if (!verification.valid) {
    return errorResponse("forbidden", "Invalid Mux webhook signature.", 401);
  }

  let event: MuxWebhookEvent;

  try {
    event = JSON.parse(rawBody) as MuxWebhookEvent;
  } catch {
    return errorResponse("invalid_request", "A valid Mux webhook JSON body is required.", 400);
  }

  const result = await processMuxWebhookEvent(event);

  if (result.status === "ignored") {
    return noStoreResponse();
  }

  if (result.status === "invalid") {
    return errorResponse("invalid_request", "A valid Mux webhook payload is required.", 400);
  }

  if (result.status === "not_found") {
    return errorResponse("not_found", "Media asset not found.", 404);
  }

  return noStoreResponse();
}
