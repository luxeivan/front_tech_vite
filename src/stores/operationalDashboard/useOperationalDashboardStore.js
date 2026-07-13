import { create } from "zustand";
import axios from "axios";

import { fetchDashboardRows } from "../../components/dashboard/js/dashboardPage.utils";

const useOperationalDashboardStore = create((set) => ({
  isLoading: false,
  error: null,
  hasLoaded: false,
  lastUpdatedAt: null,
  rows: [],
  rows7d: [],
  rowsCurrentYear: [],

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  touchUpdatedAt: () => set({ lastUpdatedAt: new Date().toISOString() }),

  loadData: async () => {
    try {
      set({ isLoading: true, error: null });
      const jwt = localStorage.getItem("jwt");
      const data = await fetchDashboardRows({ axios, jwt });
      set({
        rows: data.rows,
        rows7d: data.rows7d,
        rowsCurrentYear: data.rowsCurrentYear,
        hasLoaded: true,
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        rows: [],
        rows7d: [],
        rowsCurrentYear: [],
        hasLoaded: true,
        error: error?.message || "Ошибка загрузки данных",
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useOperationalDashboardStore;
