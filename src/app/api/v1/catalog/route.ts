import { dataResponse } from "@/lib/api/responses";
import { serializeSeries, serializeShortFilm } from "@/lib/api/serializers";
import { getPublishedSeries, getPublishedShortFilms } from "@/lib/catalog";
import { getHomeState } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [catalog, shortFilms] = await Promise.all([
    getPublishedSeries(),
    getPublishedShortFilms(),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const home = await getHomeState(user?.id ?? null);

  return dataResponse({
    catalog: catalog.map(serializeSeries),
    shortFilms: shortFilms.map(serializeShortFilm),
    home,
  });
}
