import { isDashboardBaseType, isNotDeletedTN } from "./dashboardCommon";
import { buildEngineeringSince7dIso } from "./engineeringDay";

export const MAP_SCALE = 0.55;

export const URL = import.meta.env.VITE_URL_BACKEND;
export const URL_SERVICES = import.meta.env.VITE_URL_BACKEND_SERVICES || import.meta.env.VITE_URL_BACKEND;
export const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";
export const OPERATIONAL_CHART_YEAR = 2026;

const FETCH_CONCURRENCY = 6;

const canLogDashboardPerf = () => {
  try {
    return import.meta.env.DEV || window.localStorage.getItem("dashboardPerfLog") === "1";
  } catch {
    return import.meta.env.DEV;
  }
};

const perfNow = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

const logDashboardPerf = (label, details) => {
  if (!canLogDashboardPerf()) return;
  console.info(`[dashboard-oo:load] ${label}`, details);
};

const addFieldsToQuery = (queryParts, fields = []) => [
  ...queryParts,
  ...fields.map((field, index) => `fields[${index}]=${encodeURIComponent(field)}`),
];

const runLimited = async (tasks, limit = FETCH_CONCURRENCY) => {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  });

  await Promise.all(workers);
  return results;
};

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

  const fetchAllPages = async (queryParts, pageSize = 1000, options = {}) => {
    const startedAt = perfNow();
    const label = options.label || "teh-narusheniyas";
    const queryWithFields = addFieldsToQuery(queryParts, options.fields);
    const headers = { Authorization: `Bearer ${jwt}` };
    const firstQuery = [
      "pagination[page]=1",
      `pagination[pageSize]=${pageSize}`,
      ...queryWithFields,
    ].join("&");
    const firstResp = await axios.get(`${URL}/api/teh-narusheniyas?${firstQuery}`, { headers });
    const firstList = Array.isArray(firstResp?.data?.data) ? firstResp.data.data.map(mapIt) : [];
    const pageCount = Number(firstResp?.data?.meta?.pagination?.pageCount || 1);
    const total = Number(firstResp?.data?.meta?.pagination?.total || firstList.length);
    const effectivePageSize = Number(firstResp?.data?.meta?.pagination?.pageSize || pageSize);

    logDashboardPerf(`${label}: first page`, {
      pageCount,
      total,
      requestedPageSize: pageSize,
      effectivePageSize,
      rows: firstList.length,
      ms: Math.round(perfNow() - startedAt),
    });

    if (pageCount <= 1) {
      logDashboardPerf(`${label}: complete`, {
        rows: firstList.length,
        pages: 1,
        ms: Math.round(perfNow() - startedAt),
      });
      return firstList;
    }

    const restRequests = Array.from({ length: pageCount - 1 }, (_, index) => async () => {
      const page = index + 2;
      const query = [
        `pagination[page]=${page}`,
        `pagination[pageSize]=${pageSize}`,
        ...queryWithFields,
      ].join("&");
      return axios.get(`${URL}/api/teh-narusheniyas?${query}`, { headers });
    });

    const restResponses = await runLimited(restRequests, options.concurrency || FETCH_CONCURRENCY);
    const restList = restResponses.flatMap((resp) =>
      Array.isArray(resp?.data?.data) ? resp.data.data.map(mapIt) : []
    );

    logDashboardPerf(`${label}: complete`, {
      rows: firstList.length + restList.length,
      pages: pageCount,
      concurrency: options.concurrency || FETCH_CONCURRENCY,
      ms: Math.round(perfNow() - startedAt),
    });

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
    fetchAllPages(qsOpen, 500, { label: "main/open" }),
    fetchAllPages(qsAll7d, 1000, { label: "main/7d" }),
    fetchAllPages(qsCurrentYear, 1000, { label: "main/current-year" }),
  ]);

  return {
    rows: listOpen.filter((row) => isOpenTN(row) && isDashboardBaseType(row)),
    rows7d: listAll7d.filter(isDashboardBaseType),
    rowsCurrentYear: listCurrentYear.filter(isDashboardBaseType),
  };
}

export async function fetchOperationalDashboardInitialRows({ axios, jwt }) {
  if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

  const startedAt = perfNow();
  const data = await fetchDashboardRowsPageSet({
    axios,
    jwt,
    label: "operational/open",
    queryParts: [
      "sort[0]=createDateTime:DESC",
      "filters[isActive][$eq]=true",
      "filters[BASE_TYPE][$eq]=0",
    ],
    pageSize: 500,
  });
  const rows = data.filter((row) => isOpenTN(row) && isDashboardBaseType(row) && isNotDeletedTN(row));

  logDashboardPerf("operational/initial-ready", {
    rows: rows.length,
    ms: Math.round(perfNow() - startedAt),
  });

  return rows;
}

export async function fetchOperationalDashboardCurrentYearRows({ axios, jwt }) {
  if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

  const startedAt = perfNow();
  const headers = { Authorization: `Bearer ${jwt}` };

  try {
    const response = await axios.get(
      `${URL_SERVICES}/services/operational-dashboard/current-year-counts`,
      { headers }
    );
    const rows = Array.isArray(response?.data?.rows) ? response.data.rows : [];

    if (response?.data?.ok && rows.length) {
      logDashboardPerf("operational/current-year-service: complete", {
        rows: rows.reduce((sum, row) => sum + Number(row.__count || 0), 0),
        cached: Boolean(response.data.cached),
        ms: Math.round(perfNow() - startedAt),
      });
      return rows;
    }
  } catch (error) {
    logDashboardPerf("operational/current-year-service: fallback", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
      ms: Math.round(perfNow() - startedAt),
    });
  }

  const rows = await fetchDashboardRowsPageSet({
    axios,
    jwt,
    label: "operational/current-year-fallback",
    queryParts: [
      "sort[0]=createDateTime:DESC",
      `filters[createDateTime][$gte]=${encodeURIComponent(`${OPERATIONAL_CHART_YEAR}-01-01T00:00:00.000+03:00`)}`,
      `filters[createDateTime][$lt]=${encodeURIComponent(`${OPERATIONAL_CHART_YEAR + 1}-01-01T00:00:00.000+03:00`)}`,
      "filters[BASE_TYPE][$eq]=0",
    ],
    pageSize: 100,
    concurrency: 4,
  });

  logDashboardPerf("operational/current-year-fallback: ready", {
    rows: rows.length,
    ms: Math.round(perfNow() - startedAt),
  });

  return rows.filter((row) => isDashboardBaseType(row) && isNotDeletedTN(row));
}

async function fetchDashboardRowsPageSet({
  axios,
  jwt,
  label,
  queryParts,
  fields,
  pageSize = 1000,
  concurrency = FETCH_CONCURRENCY,
}) {
  const startedAt = perfNow();
  const mapIt = (x) => (x?.attributes ? { id: x.id, ...x.attributes } : x);
  const headers = { Authorization: `Bearer ${jwt}` };
  const queryWithFields = addFieldsToQuery(queryParts, fields);
  const buildQuery = (page) =>
    [
      `pagination[page]=${page}`,
      `pagination[pageSize]=${pageSize}`,
      ...queryWithFields,
    ].join("&");

  const firstResp = await axios.get(`${URL}/api/teh-narusheniyas?${buildQuery(1)}`, { headers });
  const firstList = Array.isArray(firstResp?.data?.data) ? firstResp.data.data.map(mapIt) : [];
  const pageCount = Number(firstResp?.data?.meta?.pagination?.pageCount || 1);
  const total = Number(firstResp?.data?.meta?.pagination?.total || firstList.length);
  const effectivePageSize = Number(firstResp?.data?.meta?.pagination?.pageSize || pageSize);

  logDashboardPerf(`${label}: first page`, {
    pageCount,
    total,
    requestedPageSize: pageSize,
    effectivePageSize,
    rows: firstList.length,
    ms: Math.round(perfNow() - startedAt),
  });

  if (pageCount <= 1) {
    logDashboardPerf(`${label}: complete`, {
      rows: firstList.length,
      pages: 1,
      ms: Math.round(perfNow() - startedAt),
    });
    return firstList;
  }

  const restRequests = Array.from({ length: pageCount - 1 }, (_, index) => async () => {
    const page = index + 2;
    return axios.get(`${URL}/api/teh-narusheniyas?${buildQuery(page)}`, { headers });
  });
  const restResponses = await runLimited(restRequests, concurrency);
  const restList = restResponses.flatMap((resp) =>
    Array.isArray(resp?.data?.data) ? resp.data.data.map(mapIt) : []
  );

  logDashboardPerf(`${label}: complete`, {
    rows: firstList.length + restList.length,
    pages: pageCount,
    concurrency,
    ms: Math.round(perfNow() - startedAt),
  });

  return [...firstList, ...restList];
}
