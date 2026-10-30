// Выгрузка «слепка» текущего состояния модуля ПЭС в Excel.
// Одна строка на ПЭС, порядок как на дашборде: группы филиалов → ПО → номер.
import * as XLSX from "xlsx";
import JSZip from "jszip";
import dayjs from "dayjs";
import axios from "axios";
import { STATUS_META, formatDateTime } from "./pesModuleMeta";
import { buildGroupedPes, normalizeBranchName } from "./pesTilesBoard.utils";
import { computePesEta, isActiveEtaStatus, matchVehicleForPes } from "./pesEta";

const COLS = [
  { header: "ПЭС", width: 10 },
  { header: "Название", width: 22 },
  { header: "Мощность", width: 12 },
  { header: "Место базирования", width: 32 },
  { header: "Филиал", width: 18 },
  { header: "ПО", width: 20 },
  { header: "Телефон диспетчера", width: 18 },
  { header: "Телефон машиниста", width: 18 },
  { header: "Статус", width: 26 },
  { header: "Координаты месторасположения", width: 26 },
  { header: "Место назначения", width: 28 },
  { header: "Выезд", width: 20 },
  { header: "Время в пути", width: 14 },
  { header: "Время до места назначения", width: 16 },
  { header: "Подключение", width: 20 },
  { header: "Время в работе", width: 14 },
  { header: "Время в ремонте", width: 14 },
];

// ДД.ММ.ГГГГ разбираем сами — new Date("05.10.2026…") трактуется по-разному.
function parseMs(value) {
  if (value === null || value === undefined || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  const raw = String(value).trim();
  const m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)).getTime();
  }
  return new Date(raw).getTime();
}

function formatDurationHMS(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPowerCell(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const text = Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
  return `${text} кВт`;
}

function statusCell(item) {
  const status = item?.effectiveStatus || item?.status || "ready";
  return STATUS_META[status]?.label || status;
}

function destinationCell(item) {
  const dest = item?.destination || {};
  return dest.address || dest.title || dest.name || "";
}

function formatEtaMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `${Math.max(0, Math.round(n))} мин`;
}

function coordsCell(vehicle) {
  const lat = Number(vehicle?.lat ?? vehicle?.latitude);
  const lon = Number(vehicle?.lon ?? vehicle?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

// Машинные позиции берём с того же backend, что и карта модуля (как в pesLayer):
// на SERVICES-прокси этот эндпоинт может отдавать 500 (IP не в allowlist ГЛОНАСС).
async function fetchVehiclesForExport() {
  const base = String(import.meta.env.VITE_URL_BACKEND || "").trim().replace(/\/$/, "");
  if (!base) return [];
  try {
    const resp = await fetch(`${base}/services/pes/vehicles`);
    if (!resp.ok) throw new Error(`vehicles ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data?.vehicles) ? data.vehicles : [];
  } catch {
    return [];
  }
}

// Порядок как на странице: заданные группы филиалов, затем остатки («Прочее»).
export function orderPesLikeBoard(items, branchGroups = []) {
  const grouped = buildGroupedPes(Array.isArray(items) ? items : []);
  const byKey = new Map(grouped.map((b) => [normalizeBranchName(b.branch), b]));
  const used = new Set();
  const ordered = [];

  const pushBranch = (branch) => {
    branch.pos.forEach((p) => p.items.forEach((it) => ordered.push(it)));
  };

  branchGroups.forEach((group) => {
    (group.branches || []).forEach((branchName) => {
      const key = normalizeBranchName(branchName);
      const branch = byKey.get(key);
      if (branch && !used.has(key)) {
        used.add(key);
        pushBranch(branch);
      }
    });
  });

  grouped.forEach((branch) => {
    const key = normalizeBranchName(branch.branch);
    if (used.has(key)) return;
    used.add(key);
    pushBranch(branch);
  });

  return ordered;
}

// Время входа в текущий ремонт: последняя операция «repair» из истории модуля.
async function fetchRepairStartTimes(items) {
  const wanted = new Set(
    (items || [])
      .filter((it) => (it.effectiveStatus || it.status) === "repair")
      .map((it) => String(it.number || "").trim())
      .filter(Boolean)
  );
  const map = new Map();
  if (!wanted.size) return map;

  const base = (
    String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim() ||
    String(import.meta.env.VITE_URL_BACKEND || "").trim()
  ).replace(/\/$/, "");
  const jwt = localStorage.getItem("jwt") || "";
  const PAGE_SIZE = 200;
  const MAX_PAGES = 10;

  for (let page = 1; page <= MAX_PAGES && wanted.size; page += 1) {
    try {
      const resp = await axios.get(`${base}/services/pes/module/history`, {
        params: { action: "repair", page, pageSize: PAGE_SIZE },
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      const rows = Array.isArray(resp?.data?.items) ? resp.data.items : [];
      rows.forEach((row) => {
        const key = String(row?.pes?.number ?? "").trim();
        if (!key || !wanted.has(key) || map.has(key)) return;
        const t = parseMs(row?.eventTime);
        if (!Number.isFinite(t)) return;
        map.set(key, t);
        wanted.delete(key);
      });
      if (!rows.length) break;
      const pg = resp?.data?.pagination || {};
      if (page >= Number(pg.pageCount || 1)) break;
    } catch {
      break;
    }
  }

  return map;
}

// Текущая длительность: в пути — с выезда, в работе — с подключения,
// в ремонте — с последнего перевода в ремонт.
function liveDurations(item, status, repairStartByNumber, nowMs) {
  let trip = "";
  let work = "";
  let repair = "";

  if (status === "en_route") {
    const departMs = parseMs(item?.actualDepartureAt);
    if (Number.isFinite(departMs)) trip = formatDurationHMS(nowMs - departMs);
  } else if (status === "connected") {
    const connectMs = parseMs(item?.connectedAt);
    if (Number.isFinite(connectMs)) work = formatDurationHMS(nowMs - connectMs);
  } else if (status === "repair") {
    const repairMs = repairStartByNumber.get(String(item?.number || "").trim());
    if (Number.isFinite(repairMs)) repair = formatDurationHMS(nowMs - repairMs);
  }

  return { trip, work, repair };
}

// SheetJS CE не умеет записывать freeze panes — дописываем <pane> в XML листа.
async function freezeFirstRow(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const entry = Object.keys(zip.files).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!entry) return bytes;

  const xml = await zip.files[entry].async("string");
  const pane =
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
  const patched = xml.includes("<pane")
    ? xml
    : xml.replace(/<sheetView([^>]*?)\/>/, `<sheetView$1>${pane}</sheetView>`);
  if (patched === xml) return bytes;

  zip.file(entry, patched);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportPesSnapshotToXlsx({ items, branchGroups = [] }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { exported: 0 };

  const nowMs = Date.now();
  const [repairStartByNumber, vehicles] = await Promise.all([
    fetchRepairStartTimes(list),
    fetchVehiclesForExport(),
  ]);
  const ordered = orderPesLikeBoard(list, branchGroups);

  const wsData = [];
  for (const item of ordered) {
    const status = item?.effectiveStatus || item?.status || "ready";
    const durations = liveDurations(item, status, repairStartByNumber, nowMs);
    const vehicle = matchVehicleForPes(item, vehicles);

    // ETA до места назначения — только для активных статусов, как в карточках.
    let eta = "";
    if (isActiveEtaStatus(status)) {
      const { minutes } = await computePesEta(item, vehicles);
      eta = formatEtaMinutes(minutes);
    }

    wsData.push([
      item.number ?? "",
      item.name || "",
      formatPowerCell(item.powerKw),
      item.baseAddress || item.parkingAddress || item.locationAddress || "—",
      item.branch || "",
      item.po || "",
      item.dispatcherPhone || "",
      "", // Телефон машиниста: данных пока нет, столбец-заготовка.
      statusCell(item),
      coordsCell(vehicle),
      destinationCell(item),
      item.actualDepartureAt ? formatDateTime(item.actualDepartureAt) : "",
      durations.trip,
      eta,
      item.connectedAt ? formatDateTime(item.connectedAt) : "",
      durations.work,
      durations.repair,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet([COLS.map((c) => c.header), ...wsData]);
  ws["!cols"] = COLS.map((c) => ({ wch: c.width }));
  // Автофильтр на шапку — чтобы не проставлять руками после выгрузки.
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ПЭС");

  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const frozen = await freezeFirstRow(bytes);
  const blob = new Blob([frozen], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `pes-snapshot-${dayjs().format("YYYY-MM-DD-HH-mm")}.xlsx`);

  return { exported: wsData.length };
}
