import dayjs from "dayjs";

function safeStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function getStatusName(item) {
  const rawTop = item?.STATUS_NAME;
  if (typeof rawTop === "string" && rawTop.trim())
    return rawTop.trim().toLowerCase();

  const rawLegacy =
    item?.data?.STATUS_NAME ??
    item?.data?.data?.STATUS_NAME ??
    item?.status_name ??
    item?.data?.data?.status_name ??
    null;

  return typeof rawLegacy === "string" ? rawLegacy.trim().toLowerCase() : null;
}

function getCreateDate(item) {
  return (
    item?.createDateTime ??
    item?.data?.createDateTime ??
    item?.data?.data?.createDateTime ??
    item?.data?.data?.F81_060_EVENTDATETIME ??
    null
  );
}

function getRecoveryDate(item) {
  // факт -> план -> null
  return (
    item?.recoveryFactDateTime ??
    item?.data?.recoveryFactDateTime ??
    item?.data?.data?.F81_290_RECOVERYDATETIME ??
    item?.recoveryPlanDateTime ??
    item?.data?.recoveryPlanDateTime ??
    null
  );
}

function getDispCenter(item) {
  return (
    safeStr(item?.dispCenter) ||
    safeStr(item?.data?.dispCenter) ||
    safeStr(item?.data?.data?.DISPCENTER_NAME_) ||
    "Не указано"
  );
}

function getVoltage(item) {
  return (
    safeStr(item?.VOLTAGECLASS) ||
    safeStr(item?.data?.VOLTAGECLASS) ||
    safeStr(item?.data?.data?.VOLTAGECLASS) ||
    "Не указано"
  );
}

function getType(item) {
  return (
    safeStr(item?.VIOLATION_TYPE) ||
    safeStr(item?.data?.VIOLATION_TYPE) ||
    safeStr(item?.data?.data?.VIOLATION_TYPE) ||
    "Не указано"
  );
}

function minutesBetween(a, b) {
  const da = dayjs(a);
  const db = dayjs(b);
  if (!da.isValid() || !db.isValid()) return null;
  const diff = db.diff(da, "minute");
  return Number.isFinite(diff) ? diff : null;
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const idx = (p / 100) * (a.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function getGuid(item) {
  const raw =
    item?.guid ||
    item?.data?.guid ||
    item?.data?.data?.VIOLATION_GUID_STR ||
    item?.data?.VIOLATION_GUID_STR ||
    item?.VIOLATION_GUID_STR ||
    null;
  if (!raw) return null;
  const s = String(raw).trim();
  return s ? s.toUpperCase() : null;
}

function bestTimestamp(item) {
  const cands = [
    item?.updatedAt,
    item?.data?.updatedAt,
    item?.recoveryFactDateTime,
    item?.data?.recoveryFactDateTime,
    item?.data?.data?.F81_290_RECOVERYDATETIME,
    item?.createDateTime,
    item?.data?.createDateTime,
    item?.data?.data?.F81_060_EVENTDATETIME,
  ];
  for (const v of cands) {
    const d = dayjs(v);
    if (v && d.isValid()) return d;
  }
  return null;
}

function dedupeByGuid(items) {
  const map = new Map(); // GUID -> { it, ts }
  for (const it of Array.isArray(items) ? items : []) {
    const guid = getGuid(it);
    if (!guid) continue; // берём только записи с GUID
    const ts = bestTimestamp(it); // может быть null
    const prev = map.get(guid);
    if (!prev) {
      map.set(guid, { it, ts });
      continue;
    }
    const newer = (ts && !prev.ts) || (ts && prev.ts && ts.isAfter(prev.ts));
    if (newer) map.set(guid, { it, ts });
  }
  return Array.from(map.values()).map((x) => x.it);
}

export function computeMetrics(itemsRaw, { title = "Текущая выборка" } = {}) {
  const src = Array.isArray(itemsRaw) ? itemsRaw : [];
  const items = dedupeByGuid(src);

  // Базовые распределения
  const byStatus = {};
  const byDispCenter = {};
  const byVoltage = {};
  const byType = {};
  const byHour = {}; // по часу возникновения

  const durations = []; // минуты восстановления
  const rows = [];

  for (const tn of items) {
    const status = getStatusName(tn) || "неизвестно";
    const dc = getDispCenter(tn);
    const volt = getVoltage(tn);
    const typ = getType(tn);

    byStatus[status] = (byStatus[status] || 0) + 1;
    byDispCenter[dc] = (byDispCenter[dc] || 0) + 1;
    byVoltage[volt] = (byVoltage[volt] || 0) + 1;
    byType[typ] = (byType[typ] || 0) + 1;

    const start = getCreateDate(tn);
    const end = getRecoveryDate(tn);
    const m = minutesBetween(start, end);
    if (m !== null && m >= 0) durations.push(m);

    const startHour = dayjs(start).isValid() ? dayjs(start).hour() : null;
    if (startHour !== null) byHour[startHour] = (byHour[startHour] || 0) + 1;

    rows.push({
      guid: getGuid(tn),
      id: tn.id,
      number: tn.number,
      energoObject: tn.energoObject,
      status,
      dispCenter: dc,
      voltage: volt,
      type: typ,
      start,
      end,
      duration_min: m,
    });
  }

  // Перцентили/средние по длительности
  const p50 = percentile(durations, 50);
  const p75 = percentile(durations, 75);
  const p90 = percentile(durations, 90);
  const avg = mean(durations);
  const sd = stddev(durations);

  // Аномалии (простое правило: > avg + 2*sd) + топ-10
  const threshold = avg != null && sd != null ? avg + 2 * sd : null;
  const outliers =
    threshold == null
      ? []
      : rows
          .filter((r) => r.duration_min != null && r.duration_min > threshold)
          .sort((a, b) => b.duration_min - a.duration_min)
          .slice(0, 10);

  // Топ-3 по диспетчерским
  const topDispCenters = Object.entries(byDispCenter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // Пики по часам
  const peaksByHour = Object.entries(byHour)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    title,
    total: rows.length, // для совместимости
    total_before_dedupe: src.length,
    unique_guids: rows.length,
    byStatus,
    byDispCenter,
    byVoltage,
    byType,
    byHour,
    durations: {
      count: durations.length,
      avg_min: avg != null ? Math.round(avg) : null,
      p50_min: p50 != null ? Math.round(p50) : null,
      p75_min: p75 != null ? Math.round(p75) : null,
      p90_min: p90 != null ? Math.round(p90) : null,
      std_min: sd != null ? Math.round(sd) : null,
      threshold_anomaly_min: threshold != null ? Math.round(threshold) : null,
    },
    topDispCenters,
    peaksByHour,
    outliers, // [{guid, id, number, energoObject, ... , duration_min}]
  };
}

// На случай отсутствия LLM — «псевдо-AI» резюме из метрик
export function formatSummary(metrics) {
  const s = metrics || {};
  const d = s.durations || {};
  const top =
    s.topDispCenters?.map((x) => `${x.name} (${x.count})`).join(", ") || "—";
  const peaks =
    s.peaksByHour?.map((x) => `${x.hour}:00 (${x.count})`).join(", ") || "—";

  return [
    `Сводка: всего ТН (уникальных по GUID) — ${s.unique_guids ?? s.total}.`,
    `Статусы: ${
      Object.entries(s.byStatus || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ") || "—"
    }.`,
    `Средняя длительность восстановления — ${d.avg_min ?? "—"} мин; p50=${
      d.p50_min ?? "—"
    }, p90=${d.p90_min ?? "—"}.`,
    `Топ-3 диспетчерских по числу ТН: ${top}.`,
    `Пиковые часы возникновения: ${peaks}.`,
    `Аномалии (длительность > ${d.threshold_anomaly_min ?? "—"} мин): ${
      s.outliers?.length || 0
    }.`,
  ].join("\n");
}
