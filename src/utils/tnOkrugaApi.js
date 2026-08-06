import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const TN_OKRUGA_ENDPOINT = `${BACKEND_URL}/api/tn-okruga`;
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;
const TN_OKRUGA_STATUS = "draft";

let cachedTnOkrugaRows = null;
let cachedTnOkrugaRowsAt = 0;
let pendingTnOkrugaRowsPromise = null;

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

const toRelationList = (...relations) =>
  relations.flatMap((relation) => {
    const value = unwrapRelation(relation);
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  });

const uniqueRelationsByName = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.name || row?.documentId || row?.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const unwrapTnOkrugaRelation = unwrapRelation;
export const unwrapFirstTnOkrugaRelation = unwrapFirstRelation;

export const getTnOkrugaPoRows = (row) =>
  uniqueRelationsByName(toRelationList(row?.tn_po, row?.tn_pos));

export const getTnOkrugaDirectFilialRows = (row) =>
  uniqueRelationsByName(toRelationList(row?.tn_filialy, row?.tn_filialies));

export const getTnPoFilialRow = (poRow) =>
  unwrapFirstRelation(poRow?.tn_filialy, poRow?.tn_filialies);

export const getTnOkrugaFilialRows = (row) => {
  const directFilials = getTnOkrugaDirectFilialRows(row);
  const poFilials = getTnOkrugaPoRows(row).map(getTnPoFilialRow).filter(Boolean);
  return uniqueRelationsByName([...directFilials, ...poFilials]);
};

export async function fetchTnOkrugaRows(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && cachedTnOkrugaRows && now - cachedTnOkrugaRowsAt < CACHE_TTL_MS) {
    return cachedTnOkrugaRows;
  }
  if (!force && pendingTnOkrugaRowsPromise) return pendingTnOkrugaRowsPromise;

  pendingTnOkrugaRowsPromise = (async () => {
    const rows = [];
    let page = 1;
    let pageCount = 1;

    do {
      const { data } = await axios.get(TN_OKRUGA_ENDPOINT, {
        params: {
          status: TN_OKRUGA_STATUS,
          "filters[is_active][$eq]": true,
          "fields[0]": "name",
          "fields[1]": "source_name",
          "fields[2]": "geometry",
          "fields[3]": "properties",
          "fields[4]": "sort_order",
          "fields[5]": "is_active",
          "pagination[page]": page,
          "pagination[pageSize]": PAGE_SIZE,
          "populate[tn_pos][fields][0]": "name",
          "populate[tn_pos][fields][1]": "sort_order",
          "populate[tn_pos][fields][2]": "is_active",
          "populate[tn_pos][populate][tn_filialy][fields][0]": "name",
          "populate[tn_pos][populate][tn_filialy][fields][1]": "rezim",
          "populate[tn_pos][populate][tn_filialy][fields][2]": "is_active",
          "populate[tn_filialies][fields][0]": "name",
          "populate[tn_filialies][fields][1]": "rezim",
          "populate[tn_filialies][fields][2]": "is_active",
          "sort[0]": "sort_order:asc",
        },
        headers: getAuthHeaders(),
      });

      rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
      pageCount = Number(data?.meta?.pagination?.pageCount || 1);
      page += 1;
    } while (page <= pageCount);

    cachedTnOkrugaRows = rows;
    cachedTnOkrugaRowsAt = Date.now();
    return rows;
  })();

  try {
    return await pendingTnOkrugaRowsPromise;
  } finally {
    pendingTnOkrugaRowsPromise = null;
  }
}

export async function fetchTnOkrugaRelationRows() {
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    const { data } = await axios.get(TN_OKRUGA_ENDPOINT, {
      params: {
        status: TN_OKRUGA_STATUS,
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
        "populate[tn_pos][populate][tn_filialy][fields][0]": "name",
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
      const filialRows = getTnOkrugaFilialRows(row);
      const poRows = getTnOkrugaPoRows(row);
      const poRelations = poRows
        .map((item) => ({
          name: item?.name || "",
          filial_name: getTnPoFilialRow(item)?.name || "",
        }))
        .filter((item) => item.name);
      const filial = filialRows[0] || null;
      const po = poRows[0] || null;

      return {
        type: "Feature",
        properties: {
          ...(row.properties || {}),
          id: row.id,
          district: row.source_name || row.name,
          name: row.name,
          source_name: row.source_name,
          filial_name: filial?.name || null,
          filial_names: filialRows.map((item) => item?.name).filter(Boolean),
          filial_rezim: filial?.rezim || null,
          po_name: po?.name || null,
          po_names: poRows.map((item) => item?.name).filter(Boolean),
          po_relations: poRelations,
          rezim: filial?.rezim || row.rezim,
          sort_order: row.sort_order,
        },
        geometry: row.geometry,
      };
    }),
});
