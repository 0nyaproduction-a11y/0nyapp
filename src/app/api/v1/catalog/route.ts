import { dataResponse } from "@/lib/api/responses";
import { serializeSeries } from "@/lib/api/serializers";
import { getPublishedSeries, getMockOrCatalogRows } from "@/lib/catalog";

export async function GET() {
  const catalog = getMockOrCatalogRows(await getPublishedSeries());

  return dataResponse({
    catalog: catalog.map(serializeSeries),
  });
}
