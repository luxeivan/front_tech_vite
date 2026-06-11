import dayjs from "dayjs";
import { engineeringDayKey } from "./engineeringDay";

export const URL = import.meta.env.VITE_URL_BACKEND;

// Безопасный парсинг числа (включая { value }).
export const toNumber = (v) => {
  const val = v != null && typeof v === "object" && "value" in v ? v.value : v;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

// Унифицированный доступ к полям плоской/вложенной структуры.
export const pick = (obj, key) =>
  obj?.[key] ?? obj?.attributes?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

// Возвращает первое непустое значение из списка ключей.
export const pickAny = (obj, keys) => {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) {
    const v = pick(obj, k);
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

// Статус «открыто» для ТН.
export const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);
  return v === true || v === 1 || v === "true";
};

// Для dashboard учитываем только аварийные/внеплановые ТН.
export const baseTypeOf = (row) => {
  const raw = pick(row, "BASE_TYPE") ?? row?.BASE_TYPE ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const isDashboardBaseType = (row) => {
  return baseTypeOf(row) === 0;
};

export const s = (v) =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

export const districtName = (row) =>
  pick(row, "DISTRICT") || row?.dispCenter || row?.district || null;

export const guidOf = (row) =>
  pick(row, "guid") ||
  pick(row, "VIOLATION_GUID_STR") ||
  row?.guid ||
  row?.VIOLATION_GUID_STR ||
  null;

export const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;

export const startDate = (row) =>
  pick(row, "F81_060_EVENTDATETIME") ?? pick(row, "createDateTime") ?? null;

export const recoveryDate = (row) =>
  pick(row, "F81_290_RECOVERYDATETIME") ??
  pick(row, "F81_070_RESTOR_SUPPLAYDATETIME") ??
  null;

export const formatDateTime = (v) => (v ? dayjs(v).format("DD.MM.YYYY HH:mm:ss") : "—");

// Рабочие сутки 08:00→08:00.
export const dayKey0808 = engineeringDayKey;

export const uniqueSorted = (arr) =>
  Array.from(new Set(arr.filter(Boolean).map((x) => String(x).replace(/\s+/g, " ").trim()))).sort(
    (a, b) => a.localeCompare(b, "ru", { sensitivity: "base" })
  );

// Классификация типов СЗО.
export const classifySocialTyp = (t) => {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hosp";
  if (x.includes("поликлин")) return "clinics";
  if (x.includes("котель")) return "boilers";
  if (x.includes("кнс") || x.includes("канализац")) return "kns";
  if (x.includes("взу") || x.includes("скваж")) return "vzu";
  if (x.includes("внс")) return "vns";
  if (x.includes("ижс")) return "izhs";
  if (x.includes("снт")) return "snt";
  return null;
};

export const toNumberLoose = (v) => {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in v) return toNumberLoose(v.value);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const normalized = v.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const getRowPeopleCount = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const fields = [
    "POPULATION_COUNT",
    "populationCount",
    "POPULATION_CNT",
    "PEOPLE_COUNT",
    "peopleCount",
    "AFFECTED_POPULATION",
    "affectedPopulation",
    "PEOPLE_OFF",
    "peopleOff",
    "PEOPLE",
    "PEOPLE_ALL",
    "AFFECTED_PEOPLE",
    "affectedPeople",
    "RESIDENTS_OFF",
    "residentsOff",
    "CITIZENS_OFF",
    "citizensOff",
    "POPULATION_OFF",
    "populationOff",
    "POPULATION",
    "population",
    "ABONENTS_OFF",
    "abonentsOff",
  ];
  for (const f of fields) {
    const val = raw[f];
    if (val != null && toNumberLoose(val) > 0) return toNumberLoose(val);
  }
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];
  if (socials.length) {
    let sum = 0;
    socials.forEach((it) => {
      const v =
        it?.People ?? it?.PEOPLE ?? it?.Population ?? it?.population ?? it?.Residents ?? it?.residents ?? 0;
      sum += toNumberLoose(v);
    });
    if (sum > 0) return sum;
  }
  return 0;
};

// Подсчёт СЗО по одной строке ТН (SocialObjects + фолбэки *_ALL).
export const getRowSzoCounts = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];
  const base = {
    boilers: 0,
    ctp: 0,
    kns: 0,
    hosp: 0,
    clinics: 0,
    schools: 0,
    kindergartens: 0,
    vzu: 0,
    vns: 0,
    mkd: 0,
    izhs: 0,
    snt: 0,
    people: 0,
    points: 0,
  };

  if (socials.length) {
    const seen = {
      mkd: new Set(),
      schools: new Set(),
      kindergartens: new Set(),
      hosp: new Set(),
      clinics: new Set(),
      boilers: new Set(),
      kns: new Set(),
      vzu: new Set(),
      vns: new Set(),
      izhs: new Set(),
      snt: new Set(),
    };
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      const uniq = s(it?.FIAS).toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seen[key].has(uniq)) return;
      seen[key].add(uniq);
      base[key] += 1;
    });
  } else {
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    base.boilers = num(raw.BOILER_ALL);
    base.ctp = num(raw.CTP_ALL);
    base.hosp = num(raw.HOSPITALS_ALL);
    base.clinics = num(raw.CLINICS_ALL);
    base.schools = num(raw.SCHOOLS_ALL ?? raw.SCHOOL_ALL);
    base.kindergartens = num(
      raw.KINDERGARTENS_ALL ?? raw.KINDERGARTEN_ALL ?? raw.KINDERGARDENS_ALL
    );
    base.kns = num(raw.KNS_ALL);
    base.vzu = num(raw.WELLS_ALL);
    base.vns = num(raw.VNS_ALL);
    base.mkd = num(raw.MKD_ALL);
    base.izhs = num(raw.PRIVATE_HOUSE_ALL);
    base.snt = num(raw.SNT_ALL);
  }

  base.people = getRowPeopleCount(row);
  base.points = toNumberLoose(raw.POINTALL ?? raw.pointsCount ?? raw.placesCount);
  return base;
};
