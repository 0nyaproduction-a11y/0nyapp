import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getAllowlist() {
  return (process.env.ONYA_DEV_ACCOUNT_RESET_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const { user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  if (!user.email || !getAllowlist().includes(user.email.toLowerCase())) {
    return errorResponse("not_found", "Not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "A valid JSON body is required.", 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("active" in body) ||
    typeof body.active !== "boolean"
  ) {
    return errorResponse("invalid_request", "The active flag must be a boolean.", 400);
  }

  const supabase = createAdminClient();
  const { error: deleteError } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return errorResponse("server_error", "Unable to update Plus state.", 500);
  }

  if (body.active) {
    const { error: insertError } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      status: "active",
      plan_code: "0nya_plus_weekly",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      return errorResponse("server_error", "Unable to enable Plus.", 500);
    }
  }

  return dataResponse({ active: body.active });
}
