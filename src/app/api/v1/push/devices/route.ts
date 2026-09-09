import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  deactivatePushDevice,
  registerPushDevice,
  validatePushDeviceInput,
} from "@/lib/push-devices";

export async function POST(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Invalid JSON request body.", 400);
  }

  const validation = validatePushDeviceInput(body);

  if (!validation.valid || !validation.data) {
    return errorResponse("invalid_request", validation.error || "Invalid push device payload.", 400);
  }

  try {
    const device = await registerPushDevice(supabase, user.id, validation.data);
    return dataResponse({ device });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse("server_error", message, 500);
  }
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const url = new URL(request.url);
  let deviceId = url.searchParams.get("deviceId") || url.searchParams.get("device_id");

  if (!deviceId) {
    try {
      const body = (await request.json()) as { deviceId?: string; device_id?: string };
      deviceId = body?.deviceId || body?.device_id || null;
    } catch {
      // Body reading is optional if query parameter was provided
    }
  }

  if (!deviceId || !deviceId.trim()) {
    return errorResponse("invalid_request", "deviceId parameter is required.", 400);
  }

  try {
    const result = await deactivatePushDevice(supabase, user.id, deviceId.trim());
    return dataResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse("server_error", message, 500);
  }
}
