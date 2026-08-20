type ApiErrorCode =
  | "not_authenticated"
  | "not_found"
  | "forbidden"
  | "invalid_request"
  | "server_error";

export function dataResponse<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, withNoStore(init));
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    withNoStore({ status }),
  );
}

function withNoStore(init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return {
    ...init,
    headers,
  };
}
