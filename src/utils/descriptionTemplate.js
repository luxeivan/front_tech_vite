const num = (v) => (Number.isFinite(+v) ? +v : 0);
const s = (v) => (v == null ? "" : String(v).trim());

function dec(n, [one, few, many]) {
  n = Math.abs(Number(n)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function listNonZero(obj, suffix = "") {
  // obj: { 'поликлиник': 2, 'больниц': 0, ... }
  return Object.entries(obj)
    .filter(([, v]) => num(v) > 0)
    .map(([k, v]) => `${num(v)} ${k}${suffix}`)
    .join(", ");
}

// --- helpers for new template ---
const pad2 = (n) => String(n).padStart(2, "0");
function formatRusDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return s(v);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Классификация соц. объектов по типу из SocialObjects[].SocialTyp
function classifySocialType(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("поликлин")) return "polyclinic";
  if (x.includes("больниц")) return "hospital";
  if (x.includes("школ")) return "school";
  if (x.includes("детс") || x.includes("сад")) return "kindergarten";
  if (x.includes("котель")) return "boiler";
  if (x.includes("цтп")) return "ctp";
  if (x.includes("кнс")) return "kns";
  if (x.includes("взу")) return "wells";
  if (x.includes("внс")) return "vns";
  return null;
}

function normalizeNameForGrouping(name) {
  let n = s(name);
  if (!n) return n;
  // Убираем хвосты вида «, ввод 1», «ввод 2», «Ввод № 3» (регистр/пробелы/знаки препинания не важны)
  n = n.replace(/\s*[,(]?\s*ввод\s*№?\s*\d+\s*$/i, "");
  // Чистим завершающую пунктуацию и лишние пробелы
  n = n.replace(/\s*[.,;:]+$/g, "");
  return n.trim();
}

function collectSocialNames(arr) {
  const buckets = {
    polyclinic: new Set(),
    hospital: new Set(),
    school: new Set(),
    kindergarten: new Set(),
    boiler: new Set(),
    ctp: new Set(),
    kns: new Set(),
    wells: new Set(),
    vns: new Set(),
  };
  (Array.isArray(arr) ? arr : []).forEach((it) => {
    const key = classifySocialType(it?.SocialTyp);
    const base = normalizeNameForGrouping(it?.Name);
    if (key && base) buckets[key].add(base);
  });
  return Object.fromEntries(
    Object.entries(buckets).map(([k, set]) => [k, Array.from(set)])
  );
}

function fmtCountAndNames(count, noun, names) {
  const c = num(count);
  if (!c) return null;
  return `${c} ${noun}`;
}

export function buildDescriptionTemplate(raw = {}) {
  // 1) Поля по ТЗ заказчика
  const sc = s(raw.SCNAME);
  const when = formatRusDateTime(raw.F81_060_EVENTDATETIME); // "03:54 20.10.2025"
  const enobj = s(raw.F81_041_ENERGOOBJECTNAME);
  const volt = s(raw.VOLTAGECLASS);
  const switchName = s(raw.SWITCHDISPNAME || raw.SWITCHNAMEKEY || "");

  const tpAll = num(raw.TP_ALL);
  const rpsnAll = num(raw.RPSN_ALL);
  const tpSection = num(raw.TP_SECTION);
  const rpsnSection = num(raw.RPSN_SECTION);

  const addressList = s(raw.ADDRESS_LIST);
  const mkdAll = num(raw.MKD_ALL);
  const population = num(raw.POPULATION_COUNT);
  const abonents = num(raw.POINTALL || raw.ENOBJ_COUNT); // POINTALL по ТЗ, fallback на ENOBJ_COUNT

  // Соц. объекты: имена из SocialObjects (если есть)
  const names = collectSocialNames(raw.SocialObjects);
  const nouns = {
    polyclinic: "Поликлиник",
    hospital: "Больниц",
    school: "Школ",
    kindergarten: "Детских садов",
    boiler: "Котельных",
    ctp: "ЦТП",
    kns: "КНС",
    wells: "ВЗУ",
    vns: "ВНС",
  };

  const fullParts = [
    fmtCountAndNames(raw.CLINICS_ALL, nouns.polyclinic, names.polyclinic),
    fmtCountAndNames(raw.HOSPITALS_ALL, nouns.hospital, names.hospital),
    fmtCountAndNames(raw.SCHOOLS_ALL, nouns.school, names.school),
    fmtCountAndNames(raw.KINDERGARTENS_ALL, nouns.kindergarten, names.kindergarten),
    fmtCountAndNames(raw.BOILER_ALL, nouns.boiler, names.boiler),
    fmtCountAndNames(raw.CTP_ALL, nouns.ctp, names.ctp),
    fmtCountAndNames(raw.KNS_ALL, nouns.kns, names.kns),
    fmtCountAndNames(raw.WELLS_ALL, nouns.wells, names.wells),
    fmtCountAndNames(raw.VNS_ALL, nouns.vns, names.vns),
  ].filter(Boolean);

  const sectParts = [
    fmtCountAndNames(raw.CLINICS_SECTION, nouns.polyclinic, names.polyclinic),
    fmtCountAndNames(raw.HOSPITALS_SECTION, nouns.hospital, names.hospital),
    fmtCountAndNames(raw.SCHOOLS_SECTION, nouns.school, names.school),
    fmtCountAndNames(raw.KINDERGARTENS_SECTION, nouns.kindergarten, names.kindergarten),
    fmtCountAndNames(raw.BOILER_SECTION, nouns.boiler, names.boiler),
    fmtCountAndNames(raw.CTP_SECTION, nouns.ctp, names.ctp),
    fmtCountAndNames(raw.KNS_SECTION, nouns.kns, names.kns),
    fmtCountAndNames(raw.WELLS_SECTION, nouns.wells, names.wells),
    fmtCountAndNames(raw.VNS_SECTION, nouns.vns, names.vns),
  ].filter(Boolean);

  // ПЭС – берём из raw (ожидается, что в вызове уже подставлены верхнеуровневые значения)
  const pesCount = num(raw.PES_COUNT);
  const pesPower = s(raw.PES_POWER);

  const reserve = s(raw.POWER_RESERVE);

  // 2) Сборка фразы строго по шаблону заказчика
  const parts = [];

  parts.push(
    `АО «Мособлэнерго»${sc ? ` «${sc}».` : "."} ${when} ${enobj ? `«${enobj}» ` : ""}` +
      `автоматическое отключение выключателя ${volt ? `"${volt}"` : ""} с диспетчерским наименованием ${switchName ? `«${switchName}»` : "—"}.`
  );

  parts.push(
    `Полностью без напряжения ${tpAll} ТП, ${rpsnAll} РП, без напряжения по одной секции ${tpSection} ТП, ${rpsnSection} РП ` +
      `(${mkdAll} МКД, ${population} чел., ${abonents} абонентов).`
  );

  if (fullParts.length) {
    parts.push(`СЗО: полностью без напряжения ${fullParts.join(", " )}.`);
  }
  if (sectParts.length) {
    parts.push(`Отключены по одной секции ${sectParts.join(", ")}.`);
  }

  if (reserve) parts.push(`${reserve}.`);

  parts.push(
    `Направлена ${pesCount} ПЭС ${pesPower ? `${pesPower} кВт ` : ""}филиала.`
  );

  parts.push("Прогнозируемое время включения 2 часа.");

  // 3) Подробные списки СЗО (кроме МКД) — по требованиям заказчика
  const sections = [];
  const addSection = (title, arr) => {
    const list = Array.isArray(arr) ? arr.filter(Boolean) : [];
    if (list.length) {
      sections.push(`${title}:\n${list.join("\n")}`);
    }
  };

  addSection("Поликлиники", names.polyclinic);
  addSection("Больницы", names.hospital);
  addSection("Школы", names.school);
  addSection("Детские сады", names.kindergarten);
  addSection("Котельные", names.boiler);
  addSection("ЦТП", names.ctp);
  addSection("КНС", names.kns);
  addSection("ВЗУ", names.wells);
  addSection("ВНС", names.vns);

  // Итог: основной текст + блоки со списками
  return [parts.filter(Boolean).join(" "), sections.join("\n\n")]
    .filter(Boolean)
    .join("\n\n");
}