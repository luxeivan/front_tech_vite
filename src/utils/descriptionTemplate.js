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

export function buildDescriptionTemplate(raw = {}) {
  // 1) Базовые поля
  const date = s(raw.F81_060_EVENTDATETIME); // при желании отформатировать
  const owner = s(raw.OWN_SCNAME);           // «Раменский филиал»
  const sc = s(raw.SCNAME);                  // «Раменское ПО»
  const enobj = s(raw.F81_041_ENERGOOBJECTNAME);
  const prot = s(raw.PROTECT_TYPE);          // «МТЗ»
  const volt = s(raw.VOLTAGECLASS);          // «6кВ»
  const switchName = s(raw.SWITCHDISPNAME || raw.SWITCHNAMEKEY || "");
  const objectKey = s(raw.OBJECTNAMEKEY || "");

  const district = s(raw.DISTRICT);
  const addressList = s(raw.ADDRESS_LIST);
  const buildType = s(raw.BUILD_TYPE);

  const tpAll = num(raw.TP_ALL);
  const tpSection = num(raw.TP_SECTION);

  const mkd = num(raw.MKD_ALL);
  const people = num(raw.POPULATION_COUNT);
  const abon = num(raw.ENOBJ_COUNT);

  // ПЭС/бригады
  const brigadeAction = s(raw.BRIGADE_ACTION);
  const brigades = num(raw.BRIGADECOUNT);
  const peopleInBrig = num(raw.EMPLOYEECOUNT);
  const reserve = s(raw.POWER_RESERVE);
  const pesCount = num(raw.PES_COUNT);
  const pesPower = s(raw.PES_POWER); // единицы как в данных

  // 2) СЗО полно/по секции
  const SZO_FULL = {
    "поликлиник": num(raw.CLINICS_ALL),
    "больниц": num(raw.HOSPITALS_ALL),
    "школ": num(raw.SCHOOLS_ALL),
    "детских садов": num(raw.KINDERGARTENS_ALL),
    "котельных": num(raw.BOILER_ALL),
    "ЦТП": num(raw.CTP_ALL),
    "КНС": num(raw.KNS_ALL),
    "ВЗУ": num(raw.WELLS_ALL),
    "ВНС": num(raw.VNS_ALL),
  };
  const SZO_SECT = {
    "поликлиник": num(raw.CLINICS_SECTION),
    "больниц": num(raw.HOSPITALS_SECTION),
    "школ": num(raw.SCHOOLS_SECTION),
    "детских садов": num(raw.KINDERGARTENS_SECTION),
    "котельных": num(raw.BOILER_SECTION),
    "ЦТП": num(raw.CTP_SECTION),
    "КНС": num(raw.KNS_SECTION),
    "ВЗУ": num(raw.WELLS_SECTION),
    "ВНС": num(raw.VNS_SECTION),
  };

  const sumFull = Object.values(SZO_FULL).reduce((a, b) => a + b, 0);
  const sumSect = Object.values(SZO_SECT).reduce((a, b) => a + b, 0);
  const sumSZO = sumFull + sumSect;

  // 3) Разветвление по «условиям символов» из ТЗ:
  // - если [POPULATION_COUNT] < 1000 и СЗО=0 → короткий вариант
  // - если [POPULATION_COUNT] > 1000 и < 5000 и СЗО ≤ 5 → средний
  // - если [POPULATION_COUNT] > 5000 или СЗО > 5 → полный
  // (интерпретация по документу, можно скорректировать)  // ← из ТЗ
  let detailLevel = "short";
  if ((people > 1000 && people < 5000 && sumSZO <= 5) || (people >= 1000 && sumSZO > 0)) {
    detailLevel = "medium";
  }
  if (people > 5000 || sumSZO > 5) detailLevel = "full";

  // 4) Строим текст
  const header =
    `${date} АО «Мособлэнерго» ${owner ? owner + " " : ""}${sc ? sc + "." : ""}`.trim();

  const where =
    `${enobj}${prot ? ` ${prot}` : ""}${volt ? ` КЛ ${volt}` : ""}` +
    `${switchName ? `, выключатель ${switchName}` : ""}` +
    `${objectKey ? `, направление ${objectKey}` : ""}`;

  const consumers =
    `Без напряжения ${tpAll} ТП полностью, ${tpSection} ` +
    `ТП по одной секции (${district}${district && addressList ? ", " : ""}` +
    `${addressList}${(district || addressList) && buildType ? ", " : ""}` +
    `${buildType ? buildType + " сектор, " : ""}` +
    `${mkd} МКД, ${people} чел., ${abon} абонентов).`;

  const szoBlocks = [];

  if (sumFull > 0) {
    szoBlocks.push(
      `полное погашение — ${sumFull} шт.` +
      `${listNonZero(SZO_FULL) ? ` (${listNonZero(SZO_FULL)})` : ""}`
    );
  }
  if (sumSect > 0) {
    szoBlocks.push(
      `по одному вводу — ${sumSect} шт.` +
      `${listNonZero(SZO_SECT) ? ` (${listNonZero(SZO_SECT)})` : ""}`
    );
  }

  const szoLine = sumSZO > 0 ? `СЗО: ${szoBlocks.join("; ")}.` : "";

  const brigade =
    `${brigadeAction ? brigadeAction + ". " : ""}` +
    `Задействовано ${brigades} ${dec(brigades, ["бригада","бригады","бригад"])}, ` +
    `${peopleInBrig} ${dec(peopleInBrig, ["человек","человека","человек"])}. ` +
    `Резерв ${reserve || "—"}. ` +
    `Направлена ${pesCount} ПЭС ${pesPower}${pesPower ? " кВ" : ""}.`;

  const eta = `Прогнозируемое время включения 2 часа.`; // пока фиксировано

  // Сшиваем по уровню детализации
  if (detailLevel === "short") {
    return [header, where + ".", consumers, brigade, eta].filter(Boolean).join(" ");
  }
  if (detailLevel === "medium") {
    return [header, where + ".", consumers, szoLine, brigade, eta]
      .filter(Boolean)
      .join(" ");
  }
  // full
  return [
    "Ситуационная справка технологического нарушения",
    header,
    where + ".",
    consumers,
    szoLine,
    brigade,
    eta,
  ]
    .filter(Boolean)
    .join("\n\n");
}