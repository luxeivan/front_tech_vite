import dayjs from "dayjs";
import { isDashboardBaseType } from "./dashboardCommon";

export const MAP_SCALE = 0.55;

export const URL = import.meta.env.VITE_URL_BACKEND;
export const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";

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

  const since7d = dayjs().startOf("day").add(8, "hour").subtract(6, "day").toISOString();

  const qsOpen = [
    "pagination[page]=1",
    "pagination[pageSize]=500",
    "sort[0]=createDateTime:DESC",
    "filters[isActive][$eq]=true",
    "filters[BASE_TYPE][$eq]=0",
  ].join("&");

  const qsAll7d = [
    "pagination[page]=1",
    "pagination[pageSize]=1000",
    "sort[0]=createDateTime:DESC",
    `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
    "filters[BASE_TYPE][$eq]=0",
  ].join("&");

  const headers = { Authorization: `Bearer ${jwt}` };
  const [respOpen, respAll] = await Promise.all([
    axios.get(`${URL}/api/teh-narusheniyas?${qsOpen}`, { headers }),
    axios.get(`${URL}/api/teh-narusheniyas?${qsAll7d}`, { headers }),
  ]);

  const mapIt = (x) => (x?.attributes ? { id: x.id, ...x.attributes } : x);
  const listOpen = Array.isArray(respOpen?.data?.data) ? respOpen.data.data.map(mapIt) : [];
  const listAll7d = Array.isArray(respAll?.data?.data) ? respAll.data.data.map(mapIt) : [];

  return {
    rows: listOpen.filter((row) => isOpenTN(row) && isDashboardBaseType(row)),
    rows7d: listAll7d.filter(isDashboardBaseType),
  };
}
