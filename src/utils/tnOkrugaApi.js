import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const TN_OKRUGA_ENDPOINT = `${BACKEND_URL}/api/tn-okruga`;
const PAGE_SIZE = 100;

const mapStrapiItem = (item) =>
  item?.attributes
    ? { id: item.id, documentId: item.documentId, ...item.attributes }
    : item;

const unwrapRelation = (relation) => {
  if (!relation) return null;
  if (relation.data) return mapStrapiItem(relation.data);
  return mapStrapiItem(relation);
};

export async function fetchTnOkrugaRows() {
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    const { data } = await axios.get(TN_OKRUGA_ENDPOINT, {
      params: {
        "filters[is_active][$eq]": true,
        "pagination[page]": page,
        "pagination[pageSize]": PAGE_SIZE,
        populate: "*",
        "sort[0]": "sort_order:asc",
      },
    });

    rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
    pageCount = Number(data?.meta?.pagination?.pageCount || 1);
    page += 1;
  } while (page <= pageCount);

  return rows;
}

export const buildTnOkrugaFeatureCollection = (rows) => ({
  type: "FeatureCollection",
  features: (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.geometry)
    .map((row) => {
      const filial = unwrapRelation(row.tn_filialy);
      const po = unwrapRelation(row.tn_po);

      return {
        type: "Feature",
        properties: {
          ...(row.properties || {}),
          id: row.id,
          district: row.source_name || row.name,
          name: row.name,
          source_name: row.source_name,
          filial_name: filial?.name || null,
          filial_rezim: filial?.rezim || null,
          po_name: po?.name || null,
          rezim: filial?.rezim || row.rezim,
          sort_order: row.sort_order,
        },
        geometry: row.geometry,
      };
    }),
});
