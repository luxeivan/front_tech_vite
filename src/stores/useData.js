import axios from "axios";
import { create } from "zustand";

const urlBackend = import.meta.env.VITE_URL_BACKEND;
const DEFAULT_TNS_PAGE_SIZE = 1000;

const useData = create((set) => ({
  tns: false,
  isLoadingTns: false,
  tn: false,
  isLoadingTn: false,
  isUpdatingTn: false,
  getTns: async (opts = {}) => {
    try {
      set({ isLoadingTns: true });
      const jwt = localStorage.getItem("jwt");
      const base = `${urlBackend}/api/teh-narusheniyas`;

      const params = {
        "pagination[page]": 1,
        "pagination[pageSize]": opts.pageSize || DEFAULT_TNS_PAGE_SIZE,
        "sort[0]": "createDateTime:DESC",
      };

      if (opts.date) {
        const d = opts.date;
        const start = new Date(d.year(), d.month(), d.date(), 0, 0, 0).toISOString();
        const end = new Date(d.year(), d.month(), d.date(), 23, 59, 59).toISOString();
        params["filters[createDateTime][$gte]"] = start;
        params["filters[createDateTime][$lte]"] = end;
      }

      if (opts.violationType) {
        params["filters[VIOLATION_TYPE][$eq]"] = String(opts.violationType).trim();
      }

      if (opts.excludeViolationType) {
        params["filters[VIOLATION_TYPE][$ne]"] = String(opts.excludeViolationType).trim();
      }

      const { data } = await axios.get(base, {
        params,
        headers: { Authorization: `Bearer ${jwt}` },
      });

      set({ tns: data, isLoadingTns: false });
    } catch (error) {
      set({ isLoadingTns: false });
      console.log(`Ошибка при получении всех ТН`, error);
    }
  },

  openedCount: 0,
  loadingOpenedCount: false,
  loadOpenedCount: async (opts = {}) => {
    try {
      set({ loadingOpenedCount: true });
      const jwt = localStorage.getItem("jwt");
      const base = `${urlBackend}/api/teh-narusheniyas`;
      const params = {
        "pagination[page]": 1,
        "pagination[pageSize]": 1,
        "sort[0]": "createDateTime:DESC",
        "filters[isActive][$eq]": true,
      };
      if (opts.date) {
        const d = opts.date;
        const start = new Date(d.year(), d.month(), d.date(), 0, 0, 0).toISOString();
        const end = new Date(d.year(), d.month(), d.date(), 23, 59, 59).toISOString();
        params["filters[createDateTime][$gte]"] = start;
        params["filters[createDateTime][$lte]"] = end;
      }
      if (opts.violationType) {
        params["filters[VIOLATION_TYPE][$eq]"] = String(opts.violationType).trim();
      }
      if (opts.excludeViolationType) {
        params["filters[VIOLATION_TYPE][$ne]"] = String(opts.excludeViolationType).trim();
      }
      const { data } = await axios.get(base, {
        params,
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const total = data?.meta?.pagination?.total || 0;
      set({ openedCount: total, loadingOpenedCount: false });
    } catch (e) {
      set({ openedCount: 0, loadingOpenedCount: false });
      console.log("Ошибка при подсчёте открытых ТН", e?.message || e);
    }
  },
  

  getTn: async (documentId) => {
    try {
      set({ isLoadingTn: true });
      const res = await axios.get(
        `${urlBackend}/api/teh-narusheniyas/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }
      );
      if (res.data) {
        console.log(res.data);
        set((state) => ({ tn: res.data, isLoadingTn: false }));
      }
    } catch (error) {
      set({ isLoadingTn: false });
      console.log(`Ошибка при получении ТН ${documentId}`, error);
    }
  },

  updateTn: async (documentId, data) => {
    try {
      set({ isUpdatingTn: true });
      const res = await axios.put(
        `${urlBackend}/api/teh-narusheniyas/${documentId}`,
        {
          data: {
            data,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }
      );
      if (res.data) {
        console.log(res.data);
        set((state) => ({ isUpdatingTn: false }));
        return true;
      }
      return false;
    } catch (error) {
      set({ isUpdatingTn: false });
      console.log(`Ошибка при получении ТН ${documentId}`, error);
      return false;
    }
  },
}));

export default useData;
