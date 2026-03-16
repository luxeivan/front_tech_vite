import dayjs from "dayjs";
import { Tag, Tooltip, Space } from "antd";

export const URL = import.meta.env.VITE_URL_BACKEND;

export const PLANNED_STATUS_VALUES = [
  "запланировано",
  "начата",
  "закрыта",
  "удалена",
];

export const PLANNED_STATUS_OPTIONS = [
  { label: "Запланировано", value: "запланировано" },
  { label: "Начата", value: "начата" },
  { label: "Закрыта", value: "закрыта" },
  { label: "Удалена", value: "удалена" },
];

export function s(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export function getRawData(item) {
  return item?.data?.data ?? item?.data ?? item ?? {};
}

export function getStatusName(item) {
  const a = item?.attributes;
  const possible = [
    item?.STATUS_NAME,
    a?.STATUS_NAME,
    item?.data?.STATUS_NAME,
    item?.data?.data?.STATUS_NAME,
    item?.status_name,
    item?.data?.data?.status_name,
    a?.status_name,
  ];
  for (const v of possible) {
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  return null;
}

function hashString(value) {
  const str = String(value || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPlannedStatusName(item) {
  const rawStatus = getStatusName(item);
  if (rawStatus && PLANNED_STATUS_VALUES.includes(rawStatus)) {
    return rawStatus;
  }

  const seed =
    getField(item, "documentId") ||
    getField(item, "guid") ||
    getField(item, "VIOLATION_GUID_STR") ||
    getField(item, "id") ||
    getField(item, "number") ||
    "planned-status";

  const idx = hashString(seed) % PLANNED_STATUS_VALUES.length;
  return PLANNED_STATUS_VALUES[idx];
}

export function isOpen(item) {
  const a = item?.attributes;
  const v =
    item?.isActive ??
    a?.isActive ??
    item?.data?.isActive ??
    item?.data?.data?.isActive ??
    (a && a.isActive && a.isActive.value);

  return v === true || v === 1 || v === "true";
}

export function isGuid36(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      v.trim()
    )
  );
}

export function extractGuid(item) {
  const src = item?.attributes ? { id: item.id, ...item.attributes } : item;
  const candidates = [
    src?.guid,
    src?.VIOLATION_GUID_STR,
    src?.documentId,
    item?.guid,
    item?.VIOLATION_GUID_STR,
    item?.documentId,
    item?.data?.data?.VIOLATION_GUID_STR,
    item?.data?.data?.guid,
  ].filter(isGuid36);
  return candidates.length ? String(candidates[0]).toLowerCase() : null;
}

export function getField(item, key) {
  const src = item?.attributes ? { id: item.id, ...item.attributes } : item;
  return (
    src?.[key] ??
    src?.data?.[key] ??
    src?.data?.data?.[key] ??
    item?.[key] ??
    item?.data?.[key] ??
    item?.data?.data?.[key] ??
    null
  );
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "—";
}

export function isPlannedType(item) {
  const raw = getRawData(item);
  const top = s(getField(item, "VIOLATION_TYPE")).toLowerCase();
  const fromRaw = s(raw?.VIOLATION_TYPE).toLowerCase();
  const x = top || fromRaw;
  return x === "п" || x.includes("план");
}

// --- СЗО как в аварийках ---
const SZO_ORDER = [
  "mkd",
  "schools",
  "kindergartens",
  "hospitals",
  "polyclinics",
  "boiler",
  "water",
  "kns",
  "snt",
];

const SZO_META = {
  mkd: { label: "МКД", color: "default" },
  schools: { label: "Школы", color: "blue" },
  kindergartens: { label: "Детсады", color: "geekblue" },
  hospitals: { label: "Больницы", color: "red" },
  polyclinics: { label: "Поликлиники", color: "magenta" },
  boiler: { label: "Котельные", color: "orange" },
  water: { label: "ВЗУ", color: "green" },
  kns: { label: "КНС", color: "volcano" },
  snt: { label: "СНТ", color: "purple" },
};

function classifySocialTyp(t) {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hospitals";
  if (x.includes("поликлин")) return "polyclinics";
  if (x.includes("котель")) return "boiler";
  if (x.includes("взу") || x.includes("скваж")) return "water";
  if (x.includes("кнс")) return "kns";
  if (x.includes("снт")) return "snt";
  return null;
}

export function buildSzoSummaryFromItem(item) {
  const raw = getRawData(item);
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];

  const base = {
    mkd: { count: 0, names: [] },
    schools: { count: 0, names: [] },
    kindergartens: { count: 0, names: [] },
    hospitals: { count: 0, names: [] },
    polyclinics: { count: 0, names: [] },
    boiler: { count: 0, names: [] },
    water: { count: 0, names: [] },
    kns: { count: 0, names: [] },
    snt: { count: 0, names: [] },
  };

  const seenByKey = {
    mkd: new Set(),
    schools: new Set(),
    kindergartens: new Set(),
    hospitals: new Set(),
    polyclinics: new Set(),
    boiler: new Set(),
    water: new Set(),
    kns: new Set(),
    snt: new Set(),
  };

  if (socials.length) {
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      const uniq =
        s(it?.FIAS)?.toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seenByKey[key].has(uniq)) return;
      seenByKey[key].add(uniq);
      base[key].count += 1;
      const name = s(it?.Name);
      if (name) base[key].names.push(name);
    });
  } else {
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    base.mkd.count = num(raw.MKD_ALL);
    base.schools.count = num(raw.SCHOOLS_ALL);
    base.kindergartens.count = num(raw.KINDERGARTENS_ALL);
    base.hospitals.count = num(raw.HOSPITALS_ALL);
    base.polyclinics.count = num(raw.CLINICS_ALL);
    base.boiler.count = num(raw.BOILER_ALL);
    base.water.count = num(raw.WELLS_ALL);
    base.kns.count = num(raw.KNS_ALL);
  }

  const tags = [];
  for (const key of SZO_ORDER) {
    const { count, names } = base[key];
    if (count > 0) {
      tags.push({
        key,
        label: SZO_META[key].label,
        color: SZO_META[key].color,
        count,
        names: names.slice(0, 10),
        more: Math.max(0, names.length - 10),
      });
    }
  }
  return tags;
}

export function SzoCell({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return <span style={{ color: "#999" }}>—</span>;
  }
  return (
    <Space size={[6, 6]} wrap>
      {tags.map((t) => {
        const title = t.names.length
          ? `${t.label}: ${t.names.join(", ")}${
              t.more ? ` и ещё +${t.more}` : ""
            }`
          : `${t.label}: ${t.count} шт.`;
        return (
          <Tooltip key={t.key} title={title} mouseEnterDelay={0.15}>
            <Tag color={t.color} style={{ marginInlineEnd: 0 }}>
              {t.label}: {t.count}
            </Tag>
          </Tooltip>
        );
      })}
    </Space>
  );
}

// --- Отправки как в аварийках ---
export function parseDateFromJournalLine(line) {
  if (!line || typeof line !== "string") return 0;
  const m = line.match(/-\s(\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2})\s-/);
  if (!m) return 0;
  const [dd, mm, yyyy, hh, min, ss] = m[1]
    .replace(/\./g, " ")
    .replace(/:/g, " ")
    .split(" ")
    .map(Number);
  return new Date(yyyy, mm - 1, dd, hh, min, ss).getTime();
}

export function normalizeChannelName(raw) {
  const x = String(raw || "").toLowerCase();
  if (x.includes("едд")) return "edds";
  if (x.includes("мэс")) return "mes";
  if (x.includes("мин") && x.includes("энерг")) return "minenergo";
  if (x.includes("сбыт") || x.includes("мосэнергосб")) return "mosenergosbyt";
  return null;
}

export function parseJournalStatuses(lines) {
  const byGuid = {};
  const byNumber = {};
  const upsert = (dict, key, ch, ok, ts) => {
    if (!key) return;
    const prev = dict[key] || {};
    const prevTs = prev.__ts?.[ch] || 0;
    if (!prev.__ts) prev.__ts = {};
    if (ts >= prevTs) {
      prev[ch] = ok;
      prev.__ts[ch] = ts;
    }
    dict[key] = prev;
  };

  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (typeof line !== "string" || !line.trim()) return;
    const ts = parseDateFromJournalLine(line);
    const num = (line.match(/№\s*(\d+)/i) || [])[1] || null;
    const guidRaw =
      (
        line.match(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
        ) || []
      )[0] || null;
    const guid = isGuid36(guidRaw) ? guidRaw.toLowerCase() : null;
    const ch = normalizeChannelName(
      (
        line.match(
          /-\s*\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2}\s*-\s*([^\-\n\r:]+?)\s*-/
        ) || []
      )[1]
    );
    if (!ch) return;
    const isError = /(ошиб|error|fail|не\s*отправ)/i.test(line);
    const ok = !isError;
    if (guid) upsert(byGuid, String(guid), ch, ok, ts);
    if (num) upsert(byNumber, String(num), ch, ok, ts);
  });

  const strip = (obj) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      const c = { ...v };
      delete c.__ts;
      out[k] = c;
    });
    return out;
  };

  return { byGuid: strip(byGuid), byNumber: strip(byNumber) };
}
