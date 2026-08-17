import { create } from "zustand";
import axios from "axios";
import { buildAuditHeaders } from "../../utils/auditLogger";

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

const PES_ITEMS_CACHE_TTL_MS = 10 * 1000;
let pesItemsRequest = null;
let pesItemsLoadedAt = 0;

const usePesModuleDataStore = create((set, get) => ({
  loading: false,
  items: [],
  error: "",
  config: null,

  historyLoading: false,
  historyItems: [],
  historyPage: 1,
  historyPageSize: 20,
  historyTotal: 0,

  applyUpdated: (updated) => {
    const list = Array.isArray(updated) ? updated : [];
    if (!list.length) return;
    const byId = new Map(list.map((x) => [String(x.id), x]));
    set((state) => ({
      items: (state.items || []).map((it) => byId.get(String(it.id)) || it),
    }));
  },

  // Текущие данные ПЭС.
  loadItems: async (user, options = {}) => {
    const silent = Boolean(options?.silent);
    const force = Boolean(options?.force);
    const state = get();
    const now = Date.now();

    if (
      !force &&
      pesItemsLoadedAt > 0 &&
      Array.isArray(state.items) &&
      now - pesItemsLoadedAt < PES_ITEMS_CACHE_TTL_MS
    ) {
      return state.items;
    }

    if (!force && pesItemsRequest) {
      return pesItemsRequest;
    }

    if (!silent) set({ loading: true, error: "" });

    pesItemsRequest = (async () => {
      try {
        const base = getBackendBase();
        const { data } = await axios.get(`${base}/services/pes/module/items`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
            ...buildAuditHeaders(user, "/pes"),
          },
        });
        const rows = Array.isArray(data?.items) ? data.items : [];
        pesItemsLoadedAt = Date.now();
        set({ items: rows });
        return rows;
      } catch (e) {
        if (!silent) {
          set({ error: e?.response?.data?.message || e?.message || "Ошибка загрузки ПЭС" });
        }
        return null;
      } finally {
        pesItemsRequest = null;
        if (!silent) set({ loading: false });
      }
    })();

    return pesItemsRequest;
  },

  // Конфиг интеграций модуля ПЭС.
  loadConfig: async () => {
    try {
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/config`);
      set({ config: data || null });
    } catch {
      set({ config: null });
    }
  },

  // Журнал операций ПЭС.
  loadHistory: async ({
    nextPage,
    nextPageSize,
    branchFilter = "__all__",
    poFilter = "__all__",
    user,
  } = {}) => {
    const { historyPage, historyPageSize } = get();
    const page = nextPage || historyPage;
    const pageSize = nextPageSize || historyPageSize;

    set({ historyLoading: true });

    try {
      const base = getBackendBase();
      const params = { page, pageSize };
      if (branchFilter !== "__all__") params.branch = branchFilter;
      if (poFilter !== "__all__") params.po = poFilter;

      const { data } = await axios.get(`${base}/services/pes/module/history`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          ...buildAuditHeaders(user, "/pes"),
        },
      });

      const rows = Array.isArray(data?.items) ? data.items : [];
      const pg = data?.pagination || {};

      set({
        historyItems: rows,
        historyPage: Number(pg.page || page),
        historyPageSize: Number(pg.pageSize || pageSize),
        historyTotal: Number(pg.total || rows.length),
      });

      return null;
    } catch (e) {
      return e;
    } finally {
      set({ historyLoading: false });
    }
  },
}));

export default usePesModuleDataStore;
