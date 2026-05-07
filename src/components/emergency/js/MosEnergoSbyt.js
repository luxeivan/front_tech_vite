import dayjs from "dayjs";
import axios from "axios";

function toDate(v, withTime = false) {
  if (!v) return null;
  const d = dayjs(v);
  if (!d.isValid()) return null;
  return withTime ? d.format("YYYY-MM-DD HH:mm:ss") : d.format("YYYY-MM-DD");
}

function clean(v) {
  if (v === "—" || v === undefined || v === null || v === "") return null;
  return String(v);
}

function splitFirst(v) {
  const val = clean(v);
  if (!val) return null;
  return (
    val
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)[0] || null
  );
}

function normalizeBaseType(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapMesStatusFromBaseType(baseType) {
  if (baseType === 1) return "Плановая";
  if (baseType === 0) return "Аварийная";
  return null;
}

export function buildMosEnergoSbytPayload(tn) {
  const obj = tn?.data;
  if (!obj) return null;
  const raw = obj?.data || {};

  // Источники полей
  const Name =
    clean(raw.ADDRESS_LIST) ??
    clean(obj.addressList) ??
    clean(obj.ADDRESS_LIST) ??
    null;

  const date_off =
    toDate(raw.F81_060_EVENTDATETIME || obj.createDateTime, true) || null;

  const date_on_plan =
    toDate(
      raw.F81_070_RESTOR_SUPPLAYDATETIME || obj.recoveryPlanDateTime,
      true
    ) || null;

  const date_on_fact =
    toDate(
      raw.F81_290_RECOVERYDATETIME || obj.recoveryFactDateTime || obj.recoveryDateTime,
      true
    ) || null;

  const duration = clean(raw.F81_090);
  const duration_hours = duration ?? null;
  const duration_minutes = duration ?? null;

  const massage =
    clean(obj.description) ??
    clean(raw.DESCRIPTION) ??
    clean(raw.description) ??
    null;

  const baseType = normalizeBaseType(obj.BASE_TYPE ?? raw.BASE_TYPE);
  const status = mapMesStatusFromBaseType(baseType);

  const team_action = clean(raw.BRIGADE_ACTION) ?? null;
  const datetime_team_action = toDate(raw.CREATE_DATETIME, true) || null;

  const num_teams = clean(raw.BRIGADECOUNT) ?? null;
  const num_employee = clean(raw.EMPLOYEECOUNT) ?? null;
  const num_special_machine_unit = clean(raw.SPECIALTECHNIQUECOUNT) ?? null;
  const num_pes = clean(raw.PES_COUNT) ?? null;

  const condition = clean(raw.STATUS_NAME) ?? clean(obj.STATUS_NAME) ?? null;

  const NumberField = clean(raw.HOUSE_LIST) ?? clean(obj.HOUSE_LIST) ?? null;

  // Важно: один из этих трёх нужен (бэк берёт fias || Guid2 || FIAS_LIST)
  const Guid2 =
    splitFirst(raw.FIAS_LIST) ??
    splitFirst(obj.FIAS_LIST) ??
    splitFirst(obj.house_fias_list) ??
    null;

  const out = {};
  const externalId = clean(raw.VIOLATION_GUID_STR) ?? clean(obj.guid) ?? null;
  if (externalId != null) out.external_id = externalId;
  if (baseType != null) out.base_type = baseType;
  if (Name != null) out.Name = Name;
  if (date_off != null) out.date_off = date_off;
  if (date_on_plan != null) out.date_on_plan = date_on_plan;
  if (date_on_fact != null) out.date_on_fact = date_on_fact;
  if (duration_hours != null) out.duration_hours = duration_hours;
  if (duration_minutes != null) out.duration_minutes = duration_minutes;
  if (massage != null) out.massage = massage;
  if (status != null) out.status = status;
  if (team_action != null) out.team_action = team_action;
  if (datetime_team_action != null)
    out.datetime_team_action = datetime_team_action;
  if (num_teams != null) out.num_teams = num_teams;
  if (num_employee != null) out.num_employee = num_employee;
  if (num_special_machine_unit != null)
    out.num_special_machine_unit = num_special_machine_unit;
  if (num_pes != null) out.num_pes = num_pes;
  if (condition != null) out.condition = condition;
  if (NumberField != null) out.Number = NumberField;
  if (Guid2 != null) out.Guid2 = Guid2;

  return out;
}


export async function sendToMes(url, data, jwt, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extraHeaders,
  };
  const endpoint = `${url}/services/mes/upload`;
  const startedAt = performance.now();
  console.groupCollapsed?.("[МосЭнергоСбыт] отправка");
  console.log("[МосЭнергоСбыт] endpoint:", endpoint);
  console.log("[МосЭнергоСбыт] request body:", data);
  try {
    const res = await axios.post(endpoint, data, {
      headers,
      timeout: 90000,
    });
    console.log(
      "[МосЭнергоСбыт] response:",
      res?.data,
      `за ${Math.round(performance.now() - startedAt)}мс`
    );
    return res?.data;
  } catch (e) {
    console.error("[МосЭнергоСбыт] error:", e?.response?.data || e?.message || e);
    throw e;
  } finally {
    console.groupEnd?.();
  }
}

export default null;


export async function testMesAuth(url, jwt, extraHeaders = {}) {
  const headers = {
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extraHeaders,
  };
  const res = await axios.get(`${url}/services/mes/auth-test`, {
    headers,
    timeout: 90000,
  });
  return res?.data;
}
