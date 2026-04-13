import axios from "axios";

const SERVICES_URL = (
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND ||
  ""
).replace(/\/$/, "");

function authHeaders(jwt) {
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

export async function fetchAuditEvents(params = {}, jwt = "") {
  const query = {};
  const limit = Number(params.limit);
  if (Number.isFinite(limit) && limit > 0) query.limit = Math.min(1000, Math.trunc(limit));
  if (params.action) query.action = String(params.action).trim();
  if (params.username) query.username = String(params.username).trim();
  if (params.page) query.page = String(params.page).trim();
  if (params.search) query.search = String(params.search).trim();
  if (params.from) query.from = String(params.from).trim();
  if (params.to) query.to = String(params.to).trim();
  if (params.statusEvent) query.statusEvent = String(params.statusEvent).trim();
  if (params.tnType) query.tnType = String(params.tnType).trim();
  if (params.tnValue) query.tnValue = String(params.tnValue).trim();

  const resp = await axios.get(`${SERVICES_URL}/services/audit/events`, {
    params: query,
    headers: authHeaders(jwt),
    timeout: 10000,
  });
  return resp.data;
}

export async function fetchAuditHealth(jwt = "") {
  const resp = await axios.get(`${SERVICES_URL}/services/audit/health`, {
    headers: authHeaders(jwt),
    timeout: 6000,
  });
  return resp.data;
}

export async function fetchAuditUsers(params = {}, jwt = "") {
  const query = {};
  const limit = Number(params.limit);
  if (Number.isFinite(limit) && limit > 0) query.limit = Math.min(200, Math.trunc(limit));
  if (params.query) query.query = String(params.query).trim();
  if (params.from) query.from = String(params.from).trim();
  if (params.to) query.to = String(params.to).trim();

  const resp = await axios.get(`${SERVICES_URL}/services/audit/users`, {
    params: query,
    headers: authHeaders(jwt),
    timeout: 10000,
  });
  return resp.data;
}
