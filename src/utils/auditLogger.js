import axios from "axios";

function backendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

export function buildAuditActor(user) {
  const username =
    user?.fullName || user?.username || user?.email || "unknown";
  const role = user?.view_role || "unknown";
  return { username, role };
}

export function buildAuditHeaders(user, page = "") {
  const actor = buildAuditActor(user);
  return {
    "x-audit-username": actor.username,
    "x-audit-role": actor.role,
    "x-audit-page": page || window?.location?.pathname || "",
  };
}

export async function logAuditEvent(event, user) {
  const base = backendBase();
  if (!base) return;
  const actor = buildAuditActor(user);
  const payload = {
    ...actor,
    page: event?.page || window?.location?.pathname || "",
    action: event?.action || "unknown",
    entity: event?.entity || "ui",
    entity_id: event?.entity_id || "",
    details: event?.details || "",
  };
  try {
    await axios.post(`${base}/services/audit/event`, payload, {
      timeout: 2500,
      headers: buildAuditHeaders(user, payload.page),
    });
  } catch {
    // intentionally silent: logging must never break UX
  }
}

export function logAuditBeacon(event, user) {
  const base = backendBase();
  if (!base || typeof navigator?.sendBeacon !== "function") return;
  const actor = buildAuditActor(user);
  const payload = {
    ...actor,
    page: event?.page || window?.location?.pathname || "",
    action: event?.action || "unknown",
    entity: event?.entity || "ui",
    entity_id: event?.entity_id || "",
    details: event?.details || "",
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
