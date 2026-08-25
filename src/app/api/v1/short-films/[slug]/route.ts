import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { serializeShortFilm } from "@/lib/api/serializers";
import { getShortFilmChaiDetails } from "@/lib/chai";
import { getShortFilmBySlug } from "@/lib/catalog";
import { hasActiveSubscription } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

type ShortFilmApiRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: ShortFilmApiRouteProps) {
  const { slug } = await params;
  const auth = await getApiAuth(request);

  if (auth.error) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const shortFilm = await getShortFilmBySlug(slug);

  if (!shortFilm) {
    return errorResponse("not_found", "Short film not found.", 404);
  }

  const chai = await getShortFilmChaiDetails(slug);
  const viewerIsPlus = auth.user ? await hasActiveSubscription(auth.user.id, auth.supabase) : false;
  const serializedShortFilm = serializeShortFilm(shortFilm);

  if (viewerIsPlus) {
    Object.assign(serializedShortFilm, {
      midrollEnabled: false,
      midrollTimecodes: [],
      postrollEnabled: false,
    });
  }

  return dataResponse({
    shortFilm: serializedShortFilm,
    chai,
  });
}
