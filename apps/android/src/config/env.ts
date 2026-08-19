type MobileEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiBaseUrl: string;
};

function readEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

export function getMobileEnv(): MobileEnv {
  return {
    supabaseUrl: readEnv(
      "EXPO_PUBLIC_SUPABASE_URL",
      process.env.EXPO_PUBLIC_SUPABASE_URL,
    ),
    supabasePublishableKey: readEnv(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    apiBaseUrl: readEnv(
      "EXPO_PUBLIC_ONYA_API_BASE_URL",
      process.env.EXPO_PUBLIC_ONYA_API_BASE_URL,
    ).replace(/\/$/, ""),
  };
}
