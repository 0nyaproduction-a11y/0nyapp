import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferencesInput,
} from "@/lib/push-devices";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  try {
    const preferences = await getNotificationPreferences(supabase, user.id);
    return dataResponse({ preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse("server_error", message, 500);
  }
}

export async function PUT(request: Request) {
  const { user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Invalid JSON request body.", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("invalid_request", "Request body must be an object.", 400);
  }

  const raw = body as Record<string, unknown>;
  const input: NotificationPreferencesInput = {};

  if (typeof raw.promotions === "boolean") input.promotions = raw.promotions;
  if (typeof raw.new_releases === "boolean") input.new_releases = raw.new_releases;
  if (typeof raw.newReleases === "boolean") input.new_releases = raw.newReleases;
  if (typeof raw.account_security === "boolean") input.account_security = raw.account_security;
  if (typeof raw.accountSecurity === "boolean") input.account_security = raw.accountSecurity;

  try {
    const preferences = await updateNotificationPreferences(createAdminClient(), user.id, input);
    return dataResponse({ preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse("server_error", message, 500);
  }
}

export async function PATCH(request: Request) {
  return PUT(request);
}
