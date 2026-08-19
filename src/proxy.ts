import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon-32.png|apple-icon.png|apple-touch-icon.png|logo-dark.png|logo-og.jpg|social-preview-0nya-2026.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
