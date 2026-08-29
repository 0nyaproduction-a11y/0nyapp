import { getApiAuth } from "@/lib/api/auth";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { serializeEpisodeAccess, serializeSeries } from "@/lib/api/serializers";
import { getSeriesBySlug } from "@/lib/catalog";
import { getEpisodeAccessStates } from "@/lib/entitlements";
import { PerfCollector, runWithPerf, timePerf } from "@/lib/api/perf";

type SeriesApiRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: SeriesApiRouteProps) {
  const collector = new PerfCollector();

  return runWithPerf(collector, async () => {
    const { slug } = await params;
    const auth = await getApiAuth(request);
    const series = await getSeriesBySlug(slug, auth.error ? undefined : auth.supabase);

    if (!series) {
      const errRes = errorResponse("not_found", "Series not found.", 404);
      return collector.applyHeaders(errRes);
    }

    const episodeAccess = await timePerf("access", async () =>
      auth.user
        ? getEpisodeAccessStates(auth.user.id, series.episodes, auth.supabase)
        : getEpisodeAccessStates(null, series.episodes, auth.error ? undefined : auth.supabase)
    );

    const res = await timePerf("serialize", async () =>
      dataResponse({
        series: serializeSeries(series),
        episodeAccess: serializeEpisodeAccess(episodeAccess),
      })
    );

    return collector.applyHeaders(res);
  });
}
