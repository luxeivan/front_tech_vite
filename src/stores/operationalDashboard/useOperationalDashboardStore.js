import { create } from "zustand";
import axios from "axios";

import {
  fetchOperationalDashboardCurrentYearRows,
  fetchOperationalDashboardInitialRows,
} from "../../components/dashboard/js/dashboardPage.utils";

let loadPromise = null;
let statsPromise = null;

const useOperationalDashboardStore = create((set) => ({
  isLoading: false,
  isStatsLoading: false,
  error: null,
  statsError: null,
  hasLoaded: false,
  hasStatsLoaded: false,
  lastUpdatedAt: null,
  rows: [],
  rows7d: [],
  rowsCurrentYear: [],
  statsMeta: null,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  touchUpdatedAt: () => set({ lastUpdatedAt: new Date().toISOString() }),

  loadData: async (options = {}) => {
    if (loadPromise) return loadPromise;

    const includeStats = options.includeStats !== false;

    loadPromise = (async () => {
      try {
        set({
          isLoading: true,
          error: null,
          ...(includeStats ? { statsError: null } : {}),
        });
        const jwt = localStorage.getItem("jwt");
        const rows = await fetchOperationalDashboardInitialRows({ axios, jwt });
        set({
          rows,
          rows7d: [],
          hasLoaded: true,
          lastUpdatedAt: new Date().toISOString(),
          isLoading: false,
        });
      } catch (error) {
        set({
          rows: [],
          rows7d: [],
          hasLoaded: true,
          error: error?.message || "Ошибка загрузки данных",
          isLoading: false,
          ...(includeStats
            ? {
                rowsCurrentYear: [],
                statsMeta: null,
                hasStatsLoaded: true,
              }
            : {}),
        });
        return;
      } finally {
        loadPromise = null;
      }

      if (!includeStats) return null;

      if (statsPromise) return statsPromise;

      statsPromise = (async () => {
        try {
          set({ isStatsLoading: true, statsError: null, hasStatsLoaded: false });
          const jwt = localStorage.getItem("jwt");
          const stats = await fetchOperationalDashboardCurrentYearRows({ axios, jwt });
          set({
            rowsCurrentYear: stats.rows,
            statsMeta: stats.meta,
            hasStatsLoaded: true,
            lastUpdatedAt: new Date().toISOString(),
          });
        } catch (error) {
          set({
            statsError: error?.message || "Ошибка загрузки статистики",
            statsMeta: null,
            hasStatsLoaded: true,
          });
        } finally {
          set({ isStatsLoading: false });
          statsPromise = null;
        }
      })();

      return statsPromise;
    })();

    return loadPromise;
  },

  reloadStats: async () => {
    if (statsPromise) return statsPromise;

    statsPromise = (async () => {
      try {
        set({ isStatsLoading: true, statsError: null, hasStatsLoaded: false });
        const jwt = localStorage.getItem("jwt");
        const stats = await fetchOperationalDashboardCurrentYearRows({ axios, jwt });
        set({
          rowsCurrentYear: stats.rows,
          statsMeta: stats.meta,
          hasStatsLoaded: true,
          lastUpdatedAt: new Date().toISOString(),
        });
      } catch (error) {
        set({
          statsError: error?.message || "Ошибка загрузки статистики",
          statsMeta: null,
          hasStatsLoaded: true,
        });
      } finally {
        set({ isStatsLoading: false });
        statsPromise = null;
      }
    })();

    return statsPromise;
  },
}));

export default useOperationalDashboardStore;
