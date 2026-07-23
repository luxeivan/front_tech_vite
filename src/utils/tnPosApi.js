import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const TN_POS_ENDPOINT = `${BACKEND_URL}/api/tn-pos`;
const PAGE_SIZE = 100;

const getAuthHeaders = () => {
  const jwt = localStorage.getItem("jwt");
  return jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
};

const mapStrapiItem = (item) =>
  item?.attributes
    ? { id: item.id, documentId: item.documentId, ...item.attributes }
    : item;

export const unwrapTnPoRelation = (relation) => {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation.map(mapStrapiItem).filter(Boolean);
  if (Array.isArray(relation.data)) return relation.data.map(mapStrapiItem).filter(Boolean);
  if (relation.data) return mapStrapiItem(relation.data);
  return mapStrapiItem(relation);
};

export const unwrapFirstTnPoRelation = (...relations) => {
  for (const relation of relations) {
    const value = unwrapTnPoRelation(relation);
    if (Array.isArray(value) && value.length) return value[0];
    if (value) return value;
  }
  return null;
};

export async function fetchTnPoRows() {
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    const { data } = await axios.get(TN_POS_ENDPOINT, {
      params: {
        "filters[is_active][$eq]": true,
        "fields[0]": "name",
        "fields[1]": "sort_order",
        "fields[2]": "is_active",
        "fields[3]": "osn_resours",
        "fields[4]": "ovb",
        "pagination[page]": page,
        "pagination[pageSize]": PAGE_SIZE,
        "populate[tn_filialy][fields][0]": "name",
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
