import { create } from "zustand";
import axios from "axios";
import { buildAuditHeaders } from "../../utils/auditLogger";

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

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

  // Текущие данные ПЭС.
  loadItems: async (user) => {
    try {
      set({ loading: true, error: "" });
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/items`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          ...buildAuditHeaders(user, "/pes"),
        },
      });
      set({ items: Array.isArray(data?.items) ? data.items : [] });
    } catch (e) {
      set({ error: e?.response?.data?.message || e?.message || "Ошибка загрузки ПЭС" });
    } finally {
      set({ loading: false });
    }
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
