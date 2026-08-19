import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { serializeEpisodeAccess, serializeSeries } from "@/lib/api/serializers";
import { getSeriesBySlug as getMockSeriesBySlug } from "@/data/content";
import { getSeriesBySlug } from "@/lib/catalog";
import { getEpisodeAccessStates } from "@/lib/entitlements";

type SeriesApiRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: SeriesApiRouteProps) {
  const { slug } = await params;
  const auth = await getApiAuth(request);

  if (auth.error) {
    return errorResponse("not_authenticated", "Authentication is required.", 401);
  }

  const series = (await getSeriesBySlug(slug, auth.supabase)) ?? getMockSeriesBySlug(slug);

  if (!series) {
    return errorResponse("not_found", "Series not found.", 404);
  }

  const episodeAccess = auth.user
    ? await getEpisodeAccessStates(auth.user.id, series.episodes, auth.supabase)
    : await getEpisodeAccessStates(null, series.episodes, auth.supabase);

  return dataResponse({
    series: serializeSeries(series),
    episodeAccess: serializeEpisodeAccess(episodeAccess),
  });
}
