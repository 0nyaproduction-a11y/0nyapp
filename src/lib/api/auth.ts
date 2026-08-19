import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export type RequestSupabaseClient = SupabaseClient<Database>;

type ApiAuthResult = {
  supabase: RequestSupabaseClient;
  user: User | null;
  error: "invalid_token" | null;
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return {
      hasAuthorization: false,
      token: null,
    };
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return {
      hasAuthorization: true,
      token: null,
    };
  }

  return {
    hasAuthorization: true,
    token,
  };
}

function createBearerClient(token: string) {
  const { url, key } = getSupabaseEnv();

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export async function getApiAuth(request: Request): Promise<ApiAuthResult> {
  const bearer = getBearerToken(request);

  if (bearer.hasAuthorization && !bearer.token) {
    return {
      supabase: await createServerSupabaseClient(),
      user: null,
      error: "invalid_token",
    };
  }

  if (bearer.token) {
    const supabase = createBearerClient(bearer.token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer.token);

    return {
      supabase,
      user: error ? null : user,
      error: error ? "invalid_token" : null,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: error ? null : user,
    error: null,
  };
}
