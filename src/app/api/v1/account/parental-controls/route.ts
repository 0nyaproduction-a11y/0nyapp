import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import {
  getGuestParentalControlStatus,
  getParentalControlStatus,
  setGuestParentalPin,
  setRegisteredParentalPin,
  verifyRegisteredParentalPin,
} from "@/lib/parental-controls";

type ParentalControlActionBody = {
  currentPin?: string;
  guestCredential?: string;
  mode?: "set" | "verify";
  pin?: string;
};

export async function GET(request: Request) {
  const auth = await getApiAuth(request);
  const guestCredential = new URL(request.url).searchParams.get("guestCredential");

  if (auth.error || !auth.user) {
    const status = await getGuestParentalControlStatus(guestCredential);
    return dataResponse(status);
  }

  const status = await getParentalControlStatus(auth.user.id, auth.supabase);

  return dataResponse(status);
}

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  const body = (await request.json()) as ParentalControlActionBody;

  if (!body.pin || body.pin.length !== 4 || !/^\d{4}$/.test(body.pin)) {
    return errorResponse("invalid_request", "A 4-digit PIN is required.", 400);
  }

  const mode = body.mode ?? "set";

  if (auth.user) {
    if (mode === "verify") {
      const result = await verifyRegisteredParentalPin(auth.user.id, body.pin, auth.supabase);
      return dataResponse(result);
    }

    const result = await setRegisteredParentalPin(auth.user, body.pin, body.currentPin, auth.supabase);
    return dataResponse(result);
  }

  const result = await setGuestParentalPin({
    currentPin: body.currentPin ?? null,
    guestCredential: body.guestCredential ?? null,
    mode,
    pin: body.pin,
  });
  return dataResponse(result);
}
