import { dataResponse } from "@/lib/api/responses";
import { serializeSeries, serializeShortFilm } from "@/lib/api/serializers";
import { getPublishedSeries, getPublishedShortFilms } from "@/lib/catalog";
import { getHomeState } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";
import { PerfCollector, runWithPerf, timePerf } from "@/lib/api/perf";

export const dynamic = "force-dynamic";

export async function GET() {
  const collector = new PerfCollector();

  return runWithPerf(collector, async () => {
    const [catalog, shortFilms] = await Promise.all([
      getPublishedSeries(),
      getPublishedShortFilms(),
    ]);

    const supabase = await createClient();
    const {
      data: { user },
    } = await timePerf("auth", () => supabase.auth.getUser());
    const home = await getHomeState(user?.id ?? null);

    const res = await timePerf("serialize", async () =>
      dataResponse({
        catalog: catalog.map(serializeSeries),
        shortFilms: shortFilms.map(serializeShortFilm),
        home,
      })
    );

    return collector.applyHeaders(res);
  });
}
