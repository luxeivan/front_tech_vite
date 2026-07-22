import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;
const TN_FILIALIES_ENDPOINT = `${BACKEND_URL}/api/tn-filialies`;
const EVENTS_ENDPOINT = SERVICES_URL
  ? `${String(SERVICES_URL).replace(/\/$/, "")}/services/event`
  : "";
const PAGE_SIZE = 100;

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

export const getTnFilialyWriteId = (row) => row?.documentId || row?.id;

export const formatTnFilialyName = (name) =>
  String(name || "")
    .replace(/\s+филиал\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

export const notifyTnFilialyRezimUpdated = (payload = {}) => {
  if (typeof window === "undefined") return;

  const value = String(Date.now());
  window.dispatchEvent(new CustomEvent(TN_FILIALY_REZIM_UPDATED_EVENT));

  try {
    window.localStorage.setItem(TN_FILIALY_REZIM_UPDATED_STORAGE_KEY, value);
  } catch {
    // События достаточно для текущей вкладки; localStorage нужен только для соседних вкладок.
  }

  if (!EVENTS_ENDPOINT) return;

  axios
    .post(EVENTS_ENDPOINT, {
      type: TN_FILIALY_REZIM_UPDATED_EVENT,
      ...payload,
      timestamp: Date.now(),
    })
    .catch((error) => {
      console.warn(
        "[tn-filialy] Не удалось отправить событие обновления режима",
        error?.message || error
      );
    });
};

export async function fetchTnFilialyRows() {
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    const { data } = await axios.get(TN_FILIALIES_ENDPOINT, {
      params: {
        "filters[is_active][$eq]": true,
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

  return rows;
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

  return mapStrapiItem(data?.data);
}

export const buildTnFilialySelectOptions = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.name && getTnFilialyWriteId(row))
    .map((row) => ({
      label: formatTnFilialyName(row.name),
      value: getTnFilialyWriteId(row),
    }));
