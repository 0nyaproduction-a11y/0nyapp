import { dataResponse } from "@/lib/api/responses";
import { serializeSeries, serializeShortFilm } from "@/lib/api/serializers";
import { getPublishedSeries, getPublishedShortFilms } from "@/lib/catalog";
import { getHomeState } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";
import { PerfCollector, runWithPerf, timePerf } from "@/lib/api/perf";
import { persistRankingDecisionEvidence } from "@/lib/ranking/decision-evidence";
import { after } from "next/server";

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
    const homeWithEvidence = await getHomeState(user?.id ?? null);
    const { rankingDecisionEvidence, ...home } = homeWithEvidence;

    after(async () => {
      try {
        const results = await Promise.all(
          rankingDecisionEvidence.map((decision) =>
            persistRankingDecisionEvidence(decision, user?.id ?? null),
          ),
        );
        const failedCount = results.filter((result) => !result.recorded).length;
        if (failedCount > 0) {
          console.warn("[0nya ranking] Home decision evidence persistence failed.", { failedCount });
        }
      } catch (error) {
        console.warn(
          "[0nya ranking] Home decision evidence persistence failed open.",
          error instanceof Error ? error.message : String(error),
        );
      }
    });

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
