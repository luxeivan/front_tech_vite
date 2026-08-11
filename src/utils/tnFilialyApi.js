import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;
const TN_FILIALIES_ENDPOINT = `${BACKEND_URL}/api/tn-filialies`;
const EVENTS_ENDPOINT = SERVICES_URL
  ? `${String(SERVICES_URL).replace(/\/$/, "")}/services/event`
  : "";
const BACKEND_EVENTS_ENDPOINT = BACKEND_URL
  ? `${String(BACKEND_URL).replace(/\/$/, "")}/services/event`
  : "";
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;
const TN_FILIALIES_STATUS = "draft";

let cachedTnFilialyRows = null;
let cachedTnFilialyRowsAt = 0;
let pendingTnFilialyRowsPromise = null;
let cachedTnFilialyModeRows = null;
let cachedTnFilialyModeRowsAt = 0;
let pendingTnFilialyModeRowsPromise = null;

const getAuthHeaders = () => {
  const jwt = localStorage.getItem("jwt");
  return jwt ? { Authorization: `Bearer ${jwt}` } : undefined;
};

export const TN_FILIALY_REZIM_UPDATED_EVENT = "tn-filialy-rezim-updated";
export const TN_FILIALY_REZIM_UPDATED_STORAGE_KEY = "tnFilialyRezimUpdatedAt";

const mapStrapiItem = (item) =>
  item?.attributes
    ? { id: item.id, documentId: item.documentId, ...item.attributes }
    : item;

export const unwrapTnFilialyRelation = (relation) => {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation.map(mapStrapiItem).filter(Boolean);
  if (Array.isArray(relation.data)) return relation.data.map(mapStrapiItem).filter(Boolean);
  if (relation.data) return mapStrapiItem(relation.data);
  return mapStrapiItem(relation);
};

const toRelationList = (...relations) =>
  relations.flatMap((relation) => {
    const value = unwrapTnFilialyRelation(relation);
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  });

const getRelationKey = (row) =>
  String(row?.documentId || row?.id || row?.name || "").trim();

const uniqueRelationsByKey = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = getRelationKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const getTnFilialyOkrugaRows = (filialRow) =>
  uniqueRelationsByKey(toRelationList(filialRow?.tn_okruga, filialRow?.tn_okrugs));

export const getTnFilialyPoRows = (filialRow) =>
  uniqueRelationsByKey(toRelationList(filialRow?.tn_pos, filialRow?.tn_po));

export const getTnFilialyPoOkrugaRows = (poRow) =>
  uniqueRelationsByKey(toRelationList(poRow?.tn_okruga, poRow?.tn_okrugs));

export const getTnFilialyWriteId = (row) => row?.documentId || row?.id;

export const formatTnFilialyName = (name) =>
  String(name || "")
    .replace(/\s+филиал\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const isTnFilialyVirtualPoRow = (row) => Boolean(row?.__is_direct_okrug_po);

const createDirectOkrugPoRow = (okrugRow, filialRow) => {
  const name = okrugRow?.name || okrugRow?.source_name || "";
  if (!name) return null;

  return {
    id: `direct-okrug-${okrugRow?.documentId || okrugRow?.id || name}`,
    documentId: `direct-okrug-${okrugRow?.documentId || okrugRow?.id || name}`,
    name,
    sort_order: okrugRow?.sort_order,
    is_active: okrugRow?.is_active,
    tn_okruga: [okrugRow],
    tn_filialy: filialRow,
    tn_filialies: [filialRow],
    __is_direct_okrug_po: true,
  };
};

export const getTnFilialyAreaPoRows = (filialRow) => {
  const poRows = getTnFilialyPoRows(filialRow).filter((poRow) => poRow?.is_active !== false);
  if (poRows.length) return poRows;

  return getTnFilialyOkrugaRows(filialRow)
    .filter((okrugRow) => okrugRow?.is_active !== false)
    .map((okrugRow) => createDirectOkrugPoRow(okrugRow, filialRow))
    .filter(Boolean);
};

export const notifyTnFilialyRezimUpdated = (payload = {}) => {
  if (typeof window === "undefined") return;

  const eventPayload = {
    type: TN_FILIALY_REZIM_UPDATED_EVENT,
    ...payload,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent(TN_FILIALY_REZIM_UPDATED_EVENT, {
      detail: eventPayload,
    })
  );

  try {
    window.localStorage.setItem(
      TN_FILIALY_REZIM_UPDATED_STORAGE_KEY,
      JSON.stringify(eventPayload)
    );
  } catch {
    // События достаточно для текущей вкладки; localStorage нужен только для соседних вкладок.
  }

  const eventEndpoints = Array.from(
    new Set([EVENTS_ENDPOINT, BACKEND_EVENTS_ENDPOINT].filter(Boolean))
  );

  eventEndpoints.forEach((endpoint) => {
    axios.post(endpoint, eventPayload).catch((error) => {
      console.warn(
        "[tn-filialy] Не удалось отправить событие обновления режима",
        endpoint,
        error?.message || error
      );
    });
  });
};

export async function fetchTnFilialyRows(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && cachedTnFilialyRows && now - cachedTnFilialyRowsAt < CACHE_TTL_MS) {
    return cachedTnFilialyRows;
  }
  if (!force && pendingTnFilialyRowsPromise) return pendingTnFilialyRowsPromise;

  pendingTnFilialyRowsPromise = (async () => {
    const rows = [];
    let page = 1;
    let pageCount = 1;

    do {
      const { data } = await axios.get(TN_FILIALIES_ENDPOINT, {
        params: {
          status: TN_FILIALIES_STATUS,
          "filters[is_active][$eq]": true,
          "fields[0]": "name",
          "fields[1]": "rezim",
          "fields[2]": "is_active",
          "fields[3]": "sort_order",
          "fields[4]": "ovb",
          "fields[5]": "osn_resours",
          "pagination[page]": page,
          "pagination[pageSize]": PAGE_SIZE,
          "populate[tn_okruga][fields][0]": "name",
          "populate[tn_okruga][fields][1]": "source_name",
          "populate[tn_okruga][fields][2]": "geometry",
          "populate[tn_okruga][fields][3]": "properties",
          "populate[tn_okruga][fields][4]": "sort_order",
          "populate[tn_okruga][fields][5]": "is_active",
          "populate[tn_pos][fields][0]": "name",
          "populate[tn_pos][fields][1]": "sort_order",
          "populate[tn_pos][fields][2]": "is_active",
          "populate[tn_pos][populate][tn_okruga][fields][0]": "name",
          "populate[tn_pos][populate][tn_okruga][fields][1]": "source_name",
          "populate[tn_pos][populate][tn_okruga][fields][2]": "geometry",
          "populate[tn_pos][populate][tn_okruga][fields][3]": "properties",
          "populate[tn_pos][populate][tn_okruga][fields][4]": "sort_order",
          "populate[tn_pos][populate][tn_okruga][fields][5]": "is_active",
          "sort[0]": "sort_order:asc",
        },
        headers: getAuthHeaders(),
      });

      rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
      pageCount = Number(data?.meta?.pagination?.pageCount || 1);
      page += 1;
    } while (page <= pageCount);

    cachedTnFilialyRows = rows;
    cachedTnFilialyRowsAt = Date.now();
    return rows;
  })();

  try {
    return await pendingTnFilialyRowsPromise;
  } finally {
    pendingTnFilialyRowsPromise = null;
  }
}

export async function fetchTnFilialyModeRows(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (
    !force &&
    cachedTnFilialyModeRows &&
    now - cachedTnFilialyModeRowsAt < CACHE_TTL_MS
  ) {
    return cachedTnFilialyModeRows;
  }
  if (!force && pendingTnFilialyModeRowsPromise) {
    return pendingTnFilialyModeRowsPromise;
  }

  pendingTnFilialyModeRowsPromise = (async () => {
    const rows = [];
    let page = 1;
    let pageCount = 1;

    do {
      const { data } = await axios.get(TN_FILIALIES_ENDPOINT, {
        params: {
          status: TN_FILIALIES_STATUS,
          "filters[is_active][$eq]": true,
          "fields[0]": "name",
          "fields[1]": "rezim",
          "fields[2]": "is_active",
          "fields[3]": "sort_order",
          "pagination[page]": page,
          "pagination[pageSize]": PAGE_SIZE,
          "sort[0]": "sort_order:asc",
        },
        headers: getAuthHeaders(),
      });

      rows.push(...(Array.isArray(data?.data) ? data.data.map(mapStrapiItem) : []));
      pageCount = Number(data?.meta?.pagination?.pageCount || 1);
      page += 1;
    } while (page <= pageCount);

    cachedTnFilialyModeRows = rows;
    cachedTnFilialyModeRowsAt = Date.now();
    return rows;
  })();

  try {
    return await pendingTnFilialyModeRowsPromise;
  } finally {
    pendingTnFilialyModeRowsPromise = null;
  }
}

export async function updateTnFilialyRezim(writeId, rezim) {
  const { data } = await axios.put(
    `${TN_FILIALIES_ENDPOINT}/${writeId}`,
    {
      data: { rezim },
    },
    {
      headers: getAuthHeaders(),
    }
  );

  cachedTnFilialyRows = null;
  cachedTnFilialyRowsAt = 0;
  cachedTnFilialyModeRows = null;
  cachedTnFilialyModeRowsAt = 0;

  return mapStrapiItem(data?.data);
}

export const buildTnFilialySelectOptions = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.name && getTnFilialyWriteId(row))
    .map((row) => ({
      label: formatTnFilialyName(row.name),
      value: getTnFilialyWriteId(row),
    }));

export const buildTnFilialyTopologyOkrugaRows = (
  filialRows,
  {
    filialName = "",
    poName = "",
    poSlug = "",
    normalizeFilialName = (value) => String(value || "").trim().toLowerCase(),
    normalizePoName = (value) => String(value || "").trim().toLowerCase(),
    getPoSlug = (value) => String(value || "").trim().toLowerCase(),
  } = {}
) => {
  const normalizedFilialName = normalizeFilialName(filialName);
  const normalizedPoName = normalizePoName(poName);
  const normalizedPoSlug = String(poSlug || "").trim();
  const rowsByKey = new Map();

  const addOkrug = (filialRow, okrugRow, poRowsForOkrug = []) => {
    if (!okrugRow?.geometry || okrugRow?.is_active === false) return;
    const okrugKey = getRelationKey(okrugRow);
    if (!okrugKey) return;

    const existing = rowsByKey.get(okrugKey);
    const existingPoRows = toRelationList(existing?.tn_pos);
    const enrichedPoRows = poRowsForOkrug.map((poRow) => ({
      ...poRow,
      tn_filialy: poRow?.tn_filialy || filialRow,
      tn_filialies: uniqueRelationsByKey([...toRelationList(poRow?.tn_filialies), filialRow]),
    }));
    const nextPoRows = uniqueRelationsByKey([...existingPoRows, ...enrichedPoRows]);

    rowsByKey.set(okrugKey, {
      ...okrugRow,
      tn_filialies: uniqueRelationsByKey([
        ...toRelationList(existing?.tn_filialies),
        filialRow,
      ]),
      tn_pos: nextPoRows,
    });
  };

  (Array.isArray(filialRows) ? filialRows : [])
    .filter((filialRow) => {
      if (filialRow?.is_active === false) return false;
      if (!normalizedFilialName) return true;
      return normalizeFilialName(filialRow?.name) === normalizedFilialName;
    })
    .forEach((filialRow) => {
      const filialPoRows = getTnFilialyAreaPoRows(filialRow);
      const selectedPoRows = filialPoRows.filter((poRow) => {
        if (!normalizedPoName && !normalizedPoSlug) return true;
        const rowPoName = poRow?.name;
        return (
          (normalizedPoName && normalizePoName(rowPoName) === normalizedPoName) ||
          (normalizedPoSlug && getPoSlug(rowPoName) === normalizedPoSlug)
        );
      });
      const poRowsForDirectOkrug =
        normalizedPoName || normalizedPoSlug ? selectedPoRows : filialPoRows;

      getTnFilialyOkrugaRows(filialRow).forEach((okrugRow) => {
        const matchingPoRows = poRowsForDirectOkrug.filter((poRow) =>
          getTnFilialyPoOkrugaRows(poRow).some(
            (poOkrugRow) => getRelationKey(poOkrugRow) === getRelationKey(okrugRow)
          )
        );

        if (normalizedPoName || normalizedPoSlug) {
          if (matchingPoRows.length) addOkrug(filialRow, okrugRow, matchingPoRows);
          return;
        }

        addOkrug(filialRow, okrugRow, matchingPoRows);
      });

      selectedPoRows.forEach((poRow) => {
        if (isTnFilialyVirtualPoRow(poRow)) return;
        getTnFilialyPoOkrugaRows(poRow).forEach((okrugRow) => {
          addOkrug(filialRow, okrugRow, [poRow]);
        });
      });
    });

  return Array.from(rowsByKey.values()).sort(
    (left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
  );
};
