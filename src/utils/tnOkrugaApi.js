import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const TN_OKRUGA_ENDPOINT = `${BACKEND_URL}/api/tn-okruga`;
const PAGE_SIZE = 100;

const mapStrapiItem = (item) =>
  item?.attributes
    ? { id: item.id, documentId: item.documentId, ...item.attributes }
    : item;

export const getTnOkrugWriteId = (row) => row?.documentId || row?.id;

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
        "sort[0]": "sort_order:asc",
      },
    });

    rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
    pageCount = Number(data?.meta?.pagination?.pageCount || 1);
    page += 1;
  } while (page <= pageCount);

  return rows;
}

export async function updateTnOkrugRezim(writeId, rezim) {
  const { data } = await axios.put(`${TN_OKRUGA_ENDPOINT}/${writeId}`, {
    data: { rezim },
  });

  return mapStrapiItem(data?.data);
}

export const buildTnOkrugaFeatureCollection = (rows) => ({
  type: "FeatureCollection",
  features: (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.geometry)
    .map((row) => ({
      type: "Feature",
      properties: {
        ...(row.properties || {}),
        id: row.id,
        district: row.source_name || row.name,
        name: row.name,
        source_name: row.source_name,
        rezim: row.rezim,
        sort_order: row.sort_order,
      },
      geometry: row.geometry,
    })),
});

export const buildTnOkrugaSelectOptions = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.name && getTnOkrugWriteId(row))
    .map((row) => ({
      label: row.name,
      value: getTnOkrugWriteId(row),
    }));
