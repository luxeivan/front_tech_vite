import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const TN_OKRUGA_ENDPOINT = `${BACKEND_URL}/api/tn-okruga`;
const PAGE_SIZE = 100;

const getAuthHeaders = () => {
  const jwt = localStorage.getItem("jwt");
  return jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
};

const mapStrapiItem = (item) =>
  item?.attributes
    ? { id: item.id, documentId: item.documentId, ...item.attributes }
    : item;

const unwrapRelation = (relation) => {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation.map(mapStrapiItem).filter(Boolean);
  if (Array.isArray(relation.data)) return relation.data.map(mapStrapiItem).filter(Boolean);
  if (relation.data) return mapStrapiItem(relation.data);
  return mapStrapiItem(relation);
};

const unwrapFirstRelation = (...relations) => {
  for (const relation of relations) {
    const value = unwrapRelation(relation);
    if (Array.isArray(value) && value.length) return value[0];
    if (value) return value;
  }
  return null;
};

export const unwrapTnOkrugaRelation = unwrapRelation;
export const unwrapFirstTnOkrugaRelation = unwrapFirstRelation;

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
      headers: getAuthHeaders(),
    });

    rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
    pageCount = Number(data?.meta?.pagination?.pageCount || 1);
    page += 1;
  } while (page <= pageCount);

  return rows;
}

export async function fetchTnOkrugaRelationRows() {
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    const { data } = await axios.get(TN_OKRUGA_ENDPOINT, {
      params: {
        "filters[is_active][$eq]": true,
        "fields[0]": "name",
        "fields[1]": "source_name",
        "fields[2]": "sort_order",
        "fields[3]": "is_active",
        "pagination[page]": page,
        "pagination[pageSize]": PAGE_SIZE,
        "populate[tn_pos][fields][0]": "name",
        "populate[tn_pos][fields][1]": "sort_order",
        "populate[tn_pos][fields][2]": "is_active",
        "populate[tn_filialies][fields][0]": "name",
        "sort[0]": "sort_order:asc",
      },
      headers: getAuthHeaders(),
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
      const filial = unwrapFirstRelation(row.tn_filialy, row.tn_filialies);
      const po = unwrapFirstRelation(row.tn_po, row.tn_pos);

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
