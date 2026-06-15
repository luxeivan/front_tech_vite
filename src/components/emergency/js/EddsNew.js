import dayjs from "dayjs";
import axios from "axios";

const SHUTDOWN_TYPE_MAP = {
  А: "emergency",
  В: "unplanned",
  П: "planned",
};

const HARDCODED_EQUIPMENT_TYPE_RULES = [
  { source: "пс 110", target: "ps_110kv" },
  { source: "пс 100", target: "ps_110kv" },
  { source: "пс 35", target: "ps_35kv" },
  { source: "рп 10", target: "rp_10kv" },
  { source: "рп 6", target: "rp_6_20kv" },
  { source: "тп 0,4", target: "tp_0_4kv" },
  { source: "тп 0.4", target: "tp_0_4kv" },
  { source: "тп 6", target: "tp_6_20kv" },
  { source: "тп 10", target: "tp_6_20kv" },
  { source: "тп 20", target: "tp_6_20kv" },
  { source: "вл 110", target: "vl_110kv" },
  { source: "вл 35", target: "vl_35kv" },
  { source: "вл 0,4", target: "vl_0_4kv" },
  { source: "вл 0.4", target: "vl_0_4kv" },
  { source: "вл 6", target: "vl_6_20kv" },
  { source: "вл 10", target: "vl_6_20kv" },
  { source: "вл 20", target: "vl_6_20kv" },
  { source: "кл 100", target: "kl_100kv" },
  { source: "кл 110", target: "kl_100kv" },
  { source: "кл 35", target: "kl_35kv" },
  { source: "кл 0,4", target: "kl_0_4kv" },
  { source: "кл 0.4", target: "kl_0_4kv" },
  { source: "кл 6", target: "kl_6_20kv" },
  { source: "кл 10", target: "kl_6_20kv" },
  { source: "кл 20", target: "kl_6_20kv" },
  { source: "квл 110", target: "kvl_110kv" },
  { source: "квл 35", target: "kvl_35kv" },
  { source: "квл 0,4", target: "kvl_0_4kv" },
  { source: "квл 0.4", target: "kvl_0_4kv" },
  { source: "квл 6", target: "kvl_6_20kv" },
  { source: "квл 10", target: "kvl_6_20kv" },
  { source: "квл 20", target: "kvl_6_20kv" },
];

const HARDCODED_EQUIPMENT_KEYWORDS = [
  { keywords: ["рп"], target: "rp_10kv" },
  { keywords: ["тп"], target: "tp_6_20kv" },
  { keywords: ["пс"], target: "ps_110kv" },
  { keywords: ["вл"], target: "vl_6_20kv" },
  { keywords: ["кл"], target: "kl_6_20kv" },
  { keywords: ["квл"], target: "kvl_6_20kv" },
];

const HARDCODED_REASON_RULES = [
  { source: "направлена бригада", target: "safety_outage" },
  { source: "бригада", target: "safety_outage" },
];

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normalizeText(v) {
  return clean(v)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrict(v) {
  return normalizeText(v)
    .replace(/\(.*?\)/g, " ")
    .replace(/г\s*\.?\s*о\s*\.?/g, " ")
    .replace(/м\s*\.?\s*о\s*\.?/g, " ")
    .replace(/городск(ой|ого)?\s+округ/g, " ")
    .replace(/муниципальн(ый|ого)?\s+округ/g, " ")
    .replace(/зато/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toInt(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(String(v).replace(",", "."));
  if (Number.isFinite(n)) return Math.trunc(n);
  const digits = String(v).match(/\d+/);
  return digits ? Number(digits[0]) : fallback;
}

function toIso(v) {
  if (!v) return null;
  const d = dayjs(v);
  if (!d.isValid()) return null;
  return d.toISOString();
}

function formatMskDateTime(v) {
  if (!v) return null;
  const d = dayjs(v);
  if (!d.isValid()) return null;
  return d.toDate().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function parseFiasList(v) {
  const raw = clean(v);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[;,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function firstAddress(v) {
  const raw = clean(v);
  if (!raw) return "адрес не указан";
  const first = raw
    .split(";")
    .map((item) => item.trim())
    .find(Boolean);
  return first || "адрес не указан";
}

function toRulesArray(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter((r) => r && r.targetValue && r.sourceValue)
    .slice()
    .sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100));
}

function isRuleMatch(source, rule, normalizer = normalizeText) {
  const src = normalizer(source);
  const ruleValue = normalizer(rule?.sourceValue);
  if (!src || !ruleValue) return false;
  const mt = String(rule?.matchType || "exact").toLowerCase();
  if (mt === "contains") return src.includes(ruleValue);
  return src === ruleValue;
}

function findFirstRule(source, rules, normalizer) {
  return toRulesArray(rules).find((rule) =>
    isRuleMatch(source, rule, normalizer)
  );
}

function mapDistrictFias(districtSource, districtRules) {
  const rule = findFirstRule(districtSource, districtRules, normalizeDistrict);
  return rule?.targetValue || "";
}

function mapEquipmentType(raw, equipmentRules) {
  const objectType = clean(raw?.OBJECTTYPE81);
  const switchType = clean(raw?.SWITCHTYPE);
  const objectNameKey = clean(raw?.OBJECTNAMEKEY);
  const voltage = clean(raw?.VOLTAGECLASS);
  const dispName = clean(raw?.F81_042_DISPNAME);
  const all = [objectType, switchType, objectNameKey, voltage, dispName]
    .filter(Boolean)
    .join(" ");

  // Важно: проверяем несколько кандидатов, чтобы "ТП 6кВ" матчилось
  // даже когда между OBJECTTYPE и VOLTAGECLASS есть лишние поля.
  const candidates = [
    `${objectType} ${voltage}`.trim(),
    `${switchType} ${voltage}`.trim(),
    objectType,
    switchType,
    voltage,
    objectNameKey,
    dispName,
    all,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const rule = findFirstRule(candidate, equipmentRules, normalizeText);
    if (rule?.targetValue) return String(rule.targetValue);
  }

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    for (const hr of HARDCODED_EQUIPMENT_TYPE_RULES) {
      if (normalized.includes(hr.source)) return hr.target;
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    for (const kw of HARDCODED_EQUIPMENT_KEYWORDS) {
      if (kw.keywords.some((k) => normalized.includes(k))) return kw.target;
    }
  }

  return "";
}

function mapReasons(rawReason, reasonRules) {
  const source = clean(rawReason);
  if (!source) {
    return {
      values: [],
      errors: ["Поле BRIGADE_ACTION пустое: не удалось определить shutdownInfo.reasons."],
    };
  }

  const rules = toRulesArray(reasonRules);
  if (!rules.length) {
    return {
      values: [],
      errors: ["В Strapi нет активных правил reason_code для edds_new."],
    };
  }

  const fullRule = findFirstRule(source, rules, normalizeText);
  if (fullRule?.targetValue) {
    return { values: [String(fullRule.targetValue)], errors: [] };
  }

  const chunks = source
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const values = [];
  const errors = [];

  for (const chunk of chunks.length ? chunks : [source]) {
    const rule = findFirstRule(chunk, rules, normalizeText);
    if (rule?.targetValue) {
      const code = String(rule.targetValue);
      if (!values.includes(code)) values.push(code);
      continue;
    }

    const normalized = normalizeText(chunk);
    let matched = false;
    for (const hr of HARDCODED_REASON_RULES) {
      if (normalized.includes(hr.source)) {
        if (!values.includes(hr.target)) values.push(hr.target);
        matched = true;
        break;
      }
    }
    if (!matched) {
      errors.push(`Не удалось сматчить BRIGADE_ACTION в reasons: "${chunk}".`);
    }
  }

  return { values, errors };
}

function buildCommentText(raw) {
  const scName = clean(raw?.SCNAME) || "Не указано";
  const startAt =
    formatMskDateTime(raw?.STARTDATETIME || raw?.F81_060_EVENTDATETIME) ||
    "дата не указана";
  const planAt =
    formatMskDateTime(raw?.F81_070_RESTOR_SUPPLAYDATETIME) ||
    "дата не указана";
  const workDescription =
    clean(raw?.F81_042_DISPNAME) || "Описание работ не указано";

  const tpAll = toInt(raw?.TP_ALL);
  const subscribers = toInt(raw?.ENOBJ_COUNT);
  const peopleCount = toInt(raw?.POPULATION_COUNT);
  const pointsCount = toInt(raw?.POINTALL);
  const settlementsCount = toInt(raw?.SETTLEMENT_COUNT);
  const address = firstAddress(raw?.ADDRESS_LIST);
  const mkdAll = toInt(raw?.MKD_ALL);

  const boiler = toInt(raw?.BOILER_ALL);
  const ctp = toInt(raw?.CTP_ALL);
  const hospitals = toInt(raw?.HOSPITALS_ALL);
  const clinics = toInt(raw?.CLINICS_ALL);
  const wells = toInt(raw?.WELLS_ALL);
  const vns = toInt(raw?.VNS_ALL);
  const schools = toInt(raw?.SCHOOLS_ALL);
  const kindergartens = toInt(raw?.KINDERGARTENS_ALL);
  const kns = toInt(raw?.KNS_ALL);

  const szoSum =
    boiler + ctp + hospitals + clinics + wells + vns + schools + kindergartens + kns;
  const szoText =
    szoSum > 0
      ? `да (в том числе : котельных – ${boiler}, ЦТП – ${ctp}, больницы – ${hospitals}, поликлиники – ${clinics}, ВЗУ – ${wells}, ВНС – ${vns}, школы – ${schools}, д/с – ${kindergartens}, КНС – ${kns})`
      : "нет";

  const brigadeCount = toInt(raw?.BRIGADECOUNT);
  const employeeCount = toInt(raw?.EMPLOYEECOUNT);
  const equipmentCount = toInt(raw?.SPECIALTECHNIQUECOUNT);
  const brigadeAction = clean(raw?.BRIGADE_ACTION) || "не указано";
  const createUser = clean(raw?.CREATE_USER) || "не указан";
  const lostPower = clean(raw?.F81_220_LOSTPOWER) || "0";

  return (
    `${scName}. ${startAt} (МСК). ${workDescription}. ` +
    `Обесточенные потребители: ${tpAll} ТП (${subscribers} аб.), ${peopleCount} чел, ` +
    `Точки поставки - ${pointsCount} шт., ${settlementsCount} НП (${address}). ` +
    `МКЖД - ${mkdAll}. СЗО – ${szoText}. ` +
    `Отключенная нагрузка - ${lostPower} МВт. ` +
    `Предполагаемое время подачи напряжения: ${planAt} (МСК). ` +
    `Задействовано: ${brigadeCount} бр., ${employeeCount} чел., ${equipmentCount} ед. спец. техники. ` +
    `Наименование работ: ${brigadeAction}. ${createUser}`
  );
}

export async function fetchEddsNewMappings(url, jwt, extraHeaders = {}) {
  const headers = {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extraHeaders,
  };
  const res = await axios.get(`${url}/services/integration-mappings/edds-new`, {
    headers,
    timeout: 30000,
  });
  return res?.data?.mappings || null;
}

export async function sendToEddsNew(url, data, jwt, extraHeaders = {}) {
  const headers = {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extraHeaders,
  };
  const res = await axios.post(`${url}/services/eddsnew/`, data, {
    headers,
    timeout: 30000,
  });
  return res?.data;
}

export async function testEddsNewSend(url, data, jwt, extraHeaders = {}) {
  const headers = {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extraHeaders,
  };
  const res = await axios.post(`${url}/services/eddsnew/?debug=1`, data, {
    headers,
    timeout: 30000,
  });
  return res?.data;
}

export function buildEddsNewPayload(tn, mappings, accidentLocation = null) {
  const obj = tn?.data || tn;
  const raw = obj?.data || {};

  const errors = [];
  const meta = {};

  const violationType = clean(raw?.VIOLATION_TYPE || obj?.VIOLATION_TYPE).toUpperCase();
  const shutdownType = SHUTDOWN_TYPE_MAP[violationType];
  if (!shutdownType) {
    errors.push(
      `Неизвестный VIOLATION_TYPE="${violationType || "пусто"}". Допустимо: А, В, П.`
    );
  }

  const districtRules = Array.isArray(mappings?.district_fias)
    ? mappings.district_fias
    : [];
  const reasonRules = Array.isArray(mappings?.reason_code)
    ? mappings.reason_code
    : [];
  const equipmentRules = Array.isArray(mappings?.equipment_type)
    ? mappings.equipment_type
    : [];

  if (!districtRules.length) {
    errors.push("В Strapi нет активных правил district_fias для edds_new.");
  }
  if (!reasonRules.length) {
    errors.push("В Strapi нет активных правил reason_code для edds_new.");
  }
  if (!equipmentRules.length) {
    errors.push("В Strapi нет активных правил equipment_type для edds_new.");
  }

  const districtSource = clean(raw?.DISTRICT || raw?.SCNAME || obj?.district || obj?.dispCenter);
  const districtFiasId = mapDistrictFias(districtSource, districtRules);
  if (!districtFiasId) {
    errors.push(
      `Не найден маппинг districtFiasIds для DISTRICT="${districtSource || "пусто"}".`
    );
  }

  const equipmentName = clean(raw?.F81_041_ENERGOOBJECTNAME);
  if (!equipmentName) {
    errors.push("Не заполнено обязательное поле equipmentName (F81_041_ENERGOOBJECTNAME).");
  }

  const equipmentType = mapEquipmentType(raw, equipmentRules);
  if (!equipmentType) {
    errors.push("Не найден маппинг equipmentType по OBJECTTYPE81/VOLTAGECLASS.");
  }

  const { values: reasons, errors: reasonErrors } = mapReasons(raw?.BRIGADE_ACTION, reasonRules);
  if (reasons.length === 0) {
    reasons.push("safety_outage");
  }
  errors.push(...reasonErrors);

  const fiasIds = parseFiasList(raw?.FIAS_LIST);
  if (!fiasIds.length) {
    errors.push("Не заполнено shutdownInfo.fiasIds (ожидается FIAS_LIST).");
  }

  const disabledAt = toIso(raw?.F81_060_EVENTDATETIME || obj?.createDateTime || raw?.STARTDATETIME);
  if (!disabledAt) {
    errors.push("Не удалось определить shutdownInfo.disabledAt (F81_060_EVENTDATETIME).");
  }

  const plannedInclusionAt = toIso(raw?.F81_070_RESTOR_SUPPLAYDATETIME || obj?.recoveryPlanDateTime);
  if (!plannedInclusionAt) {
    errors.push(
      "Не удалось определить shutdownInfo.plannedInclusionAt (F81_070_RESTOR_SUPPLAYDATETIME)."
    );
  }

  const peopleCount = toInt(raw?.POPULATION_COUNT);
  const placesCount = toInt(raw?.SETTLEMENT_COUNT);
  const commentText = buildCommentText(raw);

  const payload =
    errors.length === 0
      ? {
          districtFiasIds: [districtFiasId],
          ...(accidentLocation ? { accidentLocation } : {}),
          equipmentType,
          equipmentName,
          recoveryWorkInfo: {
            workContactName: "Оперативный дежурный САЦ",
            workContactPhone: "+74957803976",
            needExternalCrew: false,
          },
          shutdownInfo: {
            shutdownType,
            deenergizedType: "staff",
            disabledAt,
            plannedInclusionAt,
            reasons,
            fiasIds,
          },
          affectedObjectsCount: {
            peopleCount,
            placesCount,
          },
          comment: {
            text: commentText,
          },
        }
      : null;

  return { payload, errors, meta };
}

export async function resolveAccidentLocation(fiasIds, districtFiasId, url, jwt) {
  const BASE = String(url || "").trim().replace(/\/$/, "");
  if (!BASE) return null;

  const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};

  async function fetchCoordsBulk(codes) {
    if (!codes.length) return [];
    try {
      const params = {
        "pagination[pageSize]": codes.length,
        fields: ["fiasId", "lat", "lon"],
      };
      codes.forEach((code, i) => {
        params[`filters[fiasId][$in][${i}]`] = code;
      });
      const res = await axios.get(`${BASE}/api/adress`, {
        params,
        headers,
        timeout: 15000,
      });
      const items = res?.data?.data || [];
      const out = [];
      for (const item of items) {
        const lat = Number(item.lat ?? item.attributes?.lat);
        const lon = Number(item.lon ?? item.attributes?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon });
      }
      return out;
    } catch {
      return [];
    }
  }

  const codes = Array.isArray(fiasIds) ? fiasIds.filter(Boolean) : [];

  if (codes.length > 0) {
    const BATCH = 100;
    const coords = [];
    for (let i = 0; i < codes.length; i += BATCH) {
      const batch = codes.slice(i, i + BATCH);
      const batchCoords = await fetchCoordsBulk(batch);
      coords.push(...batchCoords);
    }
    if (coords.length > 0) {
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
      return {
        latitude: Number(avgLat.toFixed(6)),
        longitude: Number(avgLon.toFixed(6)),
      };
    }
  }

  if (districtFiasId) {
    const dc = await fetchCoordsBulk([districtFiasId]);
    if (dc.length > 0) {
      return {
        latitude: Number(dc[0].lat.toFixed(6)),
        longitude: Number(dc[0].lon.toFixed(6)),
      };
    }
  }

  return null;
}
