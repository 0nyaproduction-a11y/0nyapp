import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { deleteAuthenticatedAccount } from "@/lib/account-deletion";

export async function POST(request: Request) {
  const auth = await getApiAuth(request);

  if (auth.error || !auth.user) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const result = await deleteAuthenticatedAccount(auth.user.id);

  if (!result.success) {
    return errorResponse("server_error", "Unable to delete account.", 500);
  }

  return dataResponse({
    success: true,
  });
}
