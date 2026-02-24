import axios from "axios";

let lastKnownActor = null;

function backendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

export function buildAuditActor(user) {
  const username =
    user?.fullName || user?.username || user?.email || lastKnownActor?.username || "unknown";
  const role = user?.view_role || lastKnownActor?.role || "unknown";
  if (username !== "unknown" && role !== "unknown") {
    lastKnownActor = { username, role };
  }
  return { username, role };
}

function isKnownActor(actor) {
  return actor.username !== "unknown" && actor.role !== "unknown";
}

function humanAction(action) {
  const map = {
    page_view: "Открыл страницу",
    page_leave: "Закрыл/покинул страницу",
    click_dashboard: "Перешел на дашборд",
    click_reset_filters: "Сбросил фильтры",
    open_send_journal: "Открыл журнал отправки",
    toggle_sound: "Переключил звук",
    tn_field_edit: "Изменил поле ТН",
    tn_description_edit: "Изменил описание ТН",
    tn_resource_edit: "Изменил ресурсные поля ТН",
    send_edds_ok: "Отправил ТН в ЕДДС",
    send_edds_error: "Ошибка отправки ТН в ЕДДС",
    send_mes_ok: "Отправил ТН в МосЭнергоСбыт",
    send_mes_error: "Ошибка отправки ТН в МосЭнергоСбыт",
    send_error: "Ошибка отправки",
    pes_dispatch: "Команда на выезд ПЭС",
    pes_reroute: "Корректировка маршрута ПЭС",
    pes_cancel: "Отмена выезда ПЭС",
    pes_depart: "Зафиксирован выезд ПЭС",
    pes_connect: "ПЭС переведена в статус Подключена",
    pes_ready: "ПЭС возвращена в резерв",
    pes_repair: "ПЭС переведена в ремонт",
  };
  return map[action] || action;
}

function normalizeDetails(event, actor) {
  const base = {
    ru: humanAction(event?.action || "unknown"),
    page: event?.page || window?.location?.pathname || "",
    actor: actor.username,
  };
  if (!event?.details) return base;
  if (typeof event.details === "string") return { ...base, message: event.details };
  if (typeof event.details === "object") return { ...base, ...event.details };
  return { ...base, message: String(event.details) };
}

export function buildAuditHeaders(user, page = "") {
  const actor = buildAuditActor(user);
  const safeUsername = encodeURIComponent(actor.username || "unknown");
  const safeRole = encodeURIComponent(actor.role || "unknown");
  return {
    "x-audit-username": safeUsername,
    "x-audit-role": safeRole,
    "x-audit-page": page || window?.location?.pathname || "",
  };
}

export async function logAuditEvent(event, user) {
  const base = backendBase();
  if (!base) return;
  const actor = buildAuditActor(user);
  if (!isKnownActor(actor) && !event?.allowAnonymous) return;
  const payload = {
    ...actor,
    page: event?.page || window?.location?.pathname || "",
    action: event?.action || "unknown",
    entity: event?.entity || "ui",
    entity_id: event?.entity_id || "",
    details: normalizeDetails(event, actor),
  };
  try {
    // Use x-www-form-urlencoded to avoid noisy CORS preflights in local dev.
    const form = new URLSearchParams();
    form.set("username", payload.username);
    form.set("role", payload.role);
    form.set("page", payload.page);
    form.set("action", payload.action);
    form.set("entity", payload.entity);
    form.set("entity_id", payload.entity_id);
    form.set("details", JSON.stringify(payload.details || {}));

    await axios.post(`${base}/services/audit/event`, form, {
      timeout: 2500,
    });
  } catch {
    // intentionally silent: logging must never break UX
  }
}

export function logAuditBeacon(event, user) {
  const base = backendBase();
  if (!base || typeof navigator?.sendBeacon !== "function") return;
  const actor = buildAuditActor(user);
  if (!isKnownActor(actor) && !event?.allowAnonymous) return;
  const payload = {
    ...actor,
    page: event?.page || window?.location?.pathname || "",
    action: event?.action || "unknown",
    entity: event?.entity || "ui",
    entity_id: event?.entity_id || "",
    details: normalizeDetails(event, actor),
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon(`${base}/services/audit/event`, blob);
  } catch {
    // no-op
  }
}
