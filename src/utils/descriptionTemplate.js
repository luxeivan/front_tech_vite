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

// --- helpers for new template ---
const pad2 = (n) => String(n).padStart(2, "0");
function formatRusDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return s(v);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(
    d.getDate()
  )}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
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

function fmtCountDeclOnly(count, forms) {
  const c = num(count);
  if (!c) return null;
  return `${c} ${dec(c, forms)}`;
}

// Согласования для категорий СЗО (ед., 2-4, 5+)
const SZO_FORMS = {
  polyclinic: ["Поликлиника", "Поликлиники", "Поликлиник"],
  hospital: ["Больница", "Больницы", "Больниц"],
  school: ["Школа", "Школы", "Школ"],
  kindergarten: ["Детский сад", "Детских сада", "Детских садов"],
  boiler: ["Котельная", "Котельные", "Котельных"],
  ctp: ["ЦТП", "ЦТП", "ЦТП"],
  kns: ["КНС", "КНС", "КНС"],
  wells: ["ВЗУ", "ВЗУ", "ВЗУ"],
  vns: ["ВНС", "ВНС", "ВНС"],
};

function formatVoltage(raw) {
  const str = s(raw);
  if (!str) return "";
  // Найдём число (поддержим "6", "6.0", "6,0")
  const m = str.match(/(\d+(?:[.,]\d+)?)/);
  if (m) {
    const n = m[1].replace(",", ".");
    return `${n}кВ`;
  }
  // Если числа нет, но есть упоминание кВ/kv — нормализуем написание
  if (/кв|kv/i.test(str)) {
    return str.replace(/\s+/g, "").replace(/kv/gi, "кВ").replace(/кв/gi, "кВ");
  }
  // Иначе добавим кВ к исходной строке
  return `${str}кВ`;
}

// Формат даты/времени для нового шаблона: "03.09.2026 02:41"
function formatDateTimeNew(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return s(v);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Краткие названия типов СЗО для сводки в скобках: «дет.сад (2), ЦТП, КНС, ВНС»
const SZO_SHORT = {
  polyclinic: "поликл.",
  hospital: "больниц.",
  school: "школа",
  kindergarten: "дет.сад",
  boiler: "котельная",
  ctp: "ЦТП",
  kns: "КНС",
  wells: "ВЗУ",
  vns: "ВНС",
};

// Подсчёт и краткая сводка СЗО: сколько всего + типы в скобках
function buildSzoSummary(countsRaw, sectionCountsRaw) {
  const full = [];
  const sect = [];

  const pushType = (arr, key, countRaw) => {
    const c = num(countRaw);
    if (!c) return;
    const short = SZO_SHORT[key];
    arr.push(c === 1 ? short : `${short} (${c})`);
  };

  pushType(full, "polyclinic", countsRaw.CLINICS_ALL);
  pushType(full, "hospital", countsRaw.HOSPITALS_ALL);
  pushType(full, "school", countsRaw.SCHOOLS_ALL);
  pushType(full, "kindergarten", countsRaw.KINDERGARTENS_ALL);
  pushType(full, "boiler", countsRaw.BOILER_ALL);
  pushType(full, "ctp", countsRaw.CTP_ALL);
  pushType(full, "kns", countsRaw.KNS_ALL);
  pushType(full, "wells", countsRaw.WELLS_ALL);
  pushType(full, "vns", countsRaw.VNS_ALL);

  pushType(sect, "polyclinic", sectionCountsRaw.CLINICS_SECTION);
  pushType(sect, "hospital", sectionCountsRaw.HOSPITALS_SECTION);
  pushType(sect, "school", sectionCountsRaw.SCHOOLS_SECTION);
  pushType(sect, "kindergarten", sectionCountsRaw.KINDERGARTENS_SECTION);
  pushType(sect, "boiler", sectionCountsRaw.BOILER_SECTION);
  pushType(sect, "ctp", sectionCountsRaw.CTP_SECTION);
  pushType(sect, "kns", sectionCountsRaw.KNS_SECTION);
  pushType(sect, "wells", sectionCountsRaw.WELLS_SECTION);
  pushType(sect, "vns", sectionCountsRaw.VNS_SECTION);

  const fullTotal = full.length;
  const sectTotal = sect.length;

  const fullStr = fullTotal
    ? `${fullTotal} (${full.join(", ")})`
    : "0";
  const sectStr = sectTotal
    ? `${sectTotal} (${sect.join(", ")})`
    : "0";

  return { fullStr, sectStr };
}

// Суммарные ТП+РП (все + по секции)
function tpRpTotal(raw) {
  const tpAll = num(raw.TP_ALL);
  const rpsnAll = num(raw.RPSN_ALL);
  return tpAll + rpsnAll;
}

function tpRpSectionTotal(raw) {
  const tpS = num(raw.TP_SECTION);
  const rpsnS = num(raw.RPSN_SECTION);
  return tpS + rpsnS;
}

// Обрезает дома из адресов и убирает строки-СЗО (названия организаций без улиц)
function stripHousesAndSzo(addressList) {
  return addressList
    .split(";")
    .map((item) => {
      let t = item.trim();
      if (!t) return "";
      // Убираем дома: "д.8 корп 1", "д 21а", ", д.21," и т.п. — всё после запятой перед "д." или в конце
      t = t.replace(/,?\s*д\.?\s*[\d].*$/i, "");
      t = t.replace(/,?\s*дом\.?\s*[\d].*$/i, "");
      t = t.replace(/,\s*$/, "").trim();
      return t;
    })
    .filter((t) => {
      if (!t) return false;
      // Убираем строки-СЗО: если нет типичных адресных ключей (ул, пер, ш, б-р, пр, км, мкр, г.)
      // и при этом похоже на название организации — пропускаем
      const hasStreet = /(ул\.|улица|пер\.|переулок|ш\.|шоссе|б-р|бульвар|пр\.|проспект|км|мкр|г\.|город)/i.test(t);
      if (!hasStreet) {
        // Проверяем, похоже ли на название организации (contains кавычки, "МУП", "ООО", "АО" и т.д.)
        const looksLikeOrg = /("|«|»|МУП|ООО|ОАО|АО|ПАО|УП|ФГБУ|ГБУ|МБУ|МКУ|ФКР)/i.test(t);
        if (looksLikeOrg) return false;
      }
      return true;
    })
    .join("; ");
}

export function buildDescriptionTemplate(raw = {}) {
  // --- Шапка ---
  const sc = s(raw.SC_PO);
  const when = formatDateTimeNew(raw.F81_060_EVENTDATETIME);
  const ownSc = s(raw.SC_FILIAL);
  const enobj = s(raw.F81_041_ENERGOOBJECTNAME);
  const voltRaw = s(raw.VOLTAGECLASS);
  const voltText = formatVoltage(voltRaw);
  const switchName = s(raw.SWITCHDISPNAME || raw.SWITCHNAMEKEY || "");
  const protect = s(raw.PROTECT_TYPE);

  const q = (x) => {
    const t = s(x);
    return t ? `${t}` : "";
  };

  const header = [
    `АО «Мособлэнерго»`,
    `${when} ${q(ownSc)} ${q(sc)}.`,
    `${q(enobj)} ${q(protect)} КЛ ${voltText} в направлении ${q(switchName)}.`,
  ]
    .join("\n")
    .replace(/\s+/g, " ")
    .replace(/\s\./g, ".");

  // --- Блок «Без напряжения» ---
  const tpRpFull = tpRpTotal(raw);
  const tpRpSect = tpRpSectionTotal(raw);
  const mkdAll = num(raw.MKD_ALL);
  const population = num(raw.POPULATION_COUNT);
  const abonents = num(raw.POINTALL || raw.ENOBJ_COUNT);

  const { fullStr, sectStr } = buildSzoSummary(raw, raw);

  const outageLines = [
    "Без напряжения:",
    `ТП, РП полностью: ${tpRpFull}`,
    `ТП, РП по одной секции: ${tpRpSect}`,
    `МКД: ${mkdAll}`,
    `Чел: ${population}`,
    `Абонентов: ${abonents}`,
    `СЗО полностью: ${fullStr}`,
    sectStr !== "0" ? `СЗО по одной секции: ${sectStr}` : null,
  ].filter(Boolean);

  // --- Адреса отключённых объектов (только улицы, без домов и СЗО) ---
  const addressList = s(raw.ADDRESS_LIST);
  if (addressList) {
    const streetsOnly = stripHousesAndSzo(addressList);
    if (streetsOnly) {
      outageLines.push(`Адреса отключенных объектов: ${streetsOnly}`);
    }
  }

  // --- Блок ПЭС и бригад ---
  const pesCount = num(raw.PES_COUNT);
  const pesPower = s(raw.PES_POWER);
  const brigadeCount = num(raw.BRIGADECOUNT);
  const employeeCount = num(raw.EMPLOYEECOUNT);

  const pesLine = pesCount
    ? `Направлено ПЭС: да (${pesCount} шт., ${pesPower ? `${pesPower} кВт` : "мощность не указана"})`
    : "Направлено ПЭС: нет";

  const brigadeLine =
    brigadeCount || employeeCount
      ? `Задействовано: ${brigadeCount} ${dec(brigadeCount, ["бригада", "бригады", "бригад"])}, ${employeeCount} ${dec(employeeCount, ["человек", "человека", "человек"])}.`
      : "Задействовано: —";

  const tail = [pesLine, brigadeLine].join("\n");

  // --- Сборка ---
  return [header, outageLines.join("\n"), tail].filter(Boolean).join("\n\n");
}
