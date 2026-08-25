import { dataResponse } from "@/lib/api/responses";
import { serializeSeries, serializeShortFilm } from "@/lib/api/serializers";
import {
  getMockOrCatalogRows,
  getMockOrCatalogShortFilms,
  getPublishedSeries,
  getPublishedShortFilms,
} from "@/lib/catalog";
import { getHomeState } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [catalog, shortFilms] = await Promise.all([
    getPublishedSeries(),
    getPublishedShortFilms(),
  ]);
  const seriesCatalog = getMockOrCatalogRows(catalog);
  const normalizedShortFilms = getMockOrCatalogShortFilms(shortFilms).map((shortFilm) =>
    shortFilm.slug === "mute-button" ? { ...shortFilm, title: "Trial & Error" } : shortFilm,
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const home = await getHomeState(user?.id ?? null);

  return dataResponse({
    catalog: seriesCatalog.map(serializeSeries),
    shortFilms: normalizedShortFilms.map(serializeShortFilm),
    home,
  });
}
