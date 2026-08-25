import type { NextConfig } from "next";

function getSupabaseRemoteImagePattern() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    return null;
  }

  const url = new URL(supabaseUrl);

  return {
    protocol: url.protocol.replace(":", "") as "http" | "https",
    hostname: url.hostname,
    port: url.port || undefined,
    pathname: "/storage/v1/object/public/content-artwork/**",
  };
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [getSupabaseRemoteImagePattern()].filter(Boolean) as NonNullable<
      NextConfig["images"]
    >["remotePatterns"],
  },
};

export default nextConfig;
