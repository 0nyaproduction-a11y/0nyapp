import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { deactivatePushDevice } from "@/lib/push-devices";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { supabase, user } = await getApiAuth(request);

  if (!user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const resolvedParams = await params;
  const deviceId = resolvedParams.deviceId;

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
