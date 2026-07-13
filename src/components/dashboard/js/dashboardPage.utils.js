import { isDashboardBaseType } from "./dashboardCommon";
import { buildEngineeringSince7dIso } from "./engineeringDay";

export const MAP_SCALE = 0.55;

export const URL = import.meta.env.VITE_URL_BACKEND;
export const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";
export const OPERATIONAL_CHART_YEAR = 2026;

// Унифицированный доступ к полям из плоского/вложенного источника.
export const pick = (obj, key) => obj?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

// Номер ТН для связки с FIAS и подписью.
export const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;

// Проверка «открытая ТН» для фильтра dashboard-виджетов.
export const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);

  return v === true || v === 1 || v === "true";
};

// Валидатор FIAS-кода (с дефисами и без).
export const isFiasGuid = (s) => {
  if (!s && s !== 0) return false;
  const str = String(s).trim();
  return (
    /^[0-9a-fA-F]{32}$/.test(str) ||
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str)
  );
};

// Извлечение FIAS только из FIAS_LIST.
export const extractFiasFromRow = (row) => {
  const seen = new Set();
  const candidates = [row?.data?.FIAS_LIST, row?.FIAS_LIST, row?.data?.data?.FIAS_LIST];
  for (const src of candidates) {
    if (!src) continue;
    String(src)
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => {
        if (isFiasGuid(t)) seen.add(t);
      });
  }
  return Array.from(seen);
};

// Единая загрузка данных dashboard: открытые ТН + все ТН за 7 дней.
export async function fetchDashboardRows({ axios, jwt }) {
  if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

  const since7d = buildEngineeringSince7dIso();
  const mapIt = (x) => (x?.attributes ? { id: x.id, ...x.attributes } : x);

  const fetchAllPages = async (queryParts, pageSize = 1000) => {
    const headers = { Authorization: `Bearer ${jwt}` };
    const firstQuery = [
      "pagination[page]=1",
      `pagination[pageSize]=${pageSize}`,
      ...queryParts,
    ].join("&");
    const firstResp = await axios.get(`${URL}/api/teh-narusheniyas?${firstQuery}`, { headers });
    const firstList = Array.isArray(firstResp?.data?.data) ? firstResp.data.data.map(mapIt) : [];
    const pageCount = Number(firstResp?.data?.meta?.pagination?.pageCount || 1);

    if (pageCount <= 1) return firstList;

    const restRequests = Array.from({ length: pageCount - 1 }, (_, index) => {
      const page = index + 2;
      const query = [
        `pagination[page]=${page}`,
        `pagination[pageSize]=${pageSize}`,
        ...queryParts,
      ].join("&");
      return axios.get(`${URL}/api/teh-narusheniyas?${query}`, { headers });
    });

    const restResponses = await Promise.all(restRequests);
    const restList = restResponses.flatMap((resp) =>
      Array.isArray(resp?.data?.data) ? resp.data.data.map(mapIt) : []
    );

    return [...firstList, ...restList];
  };

  const qsOpen = [
    "sort[0]=createDateTime:DESC",
    "filters[isActive][$eq]=true",
    "filters[BASE_TYPE][$eq]=0",
  ];

  const qsAll7d = [
    "sort[0]=createDateTime:DESC",
    `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
    "filters[BASE_TYPE][$eq]=0",
  ];

  const qsCurrentYear = [
    "sort[0]=createDateTime:DESC",
    `filters[createDateTime][$gte]=${encodeURIComponent(`${OPERATIONAL_CHART_YEAR}-01-01T00:00:00.000+03:00`)}`,
    `filters[createDateTime][$lt]=${encodeURIComponent(`${OPERATIONAL_CHART_YEAR + 1}-01-01T00:00:00.000+03:00`)}`,
    "filters[BASE_TYPE][$eq]=0",
  ];

  const [listOpen, listAll7d, listCurrentYear] = await Promise.all([
    fetchAllPages(qsOpen, 500),
    fetchAllPages(qsAll7d, 1000),
    fetchAllPages(qsCurrentYear, 1000),
  ]);

  return {
    rows: listOpen.filter((row) => isOpenTN(row) && isDashboardBaseType(row)),
    rows7d: listAll7d.filter(isDashboardBaseType),
    rowsCurrentYear: listCurrentYear.filter(isDashboardBaseType),
  };
}
