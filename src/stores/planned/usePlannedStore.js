import { create } from "zustand";
import axios from "axios";
import dayjs from "dayjs";

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PLANNED_STATUSES,
  DEFAULT_TNS_PAGE_SIZE,
  ALL_BRANCHES,
  ALL_PO,
  buildPlannedDataKey,
  buildPrimaryRequestParams,
  normalizePlannedRows,
  filterPlannedRows,
  sortPlannedRows,
  buildPlannedStats,
  getEffectiveStatuses,
} from "../../components/planned/js/plannedTableFilters";
import { parseJournalStatuses } from "../../components/planned/js/plannedTable.utils";

const usePlannedStore = create((set, get) => ({
  // --- Стейт ---
  pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
  date: null,
  selectedBranch: ALL_BRANCHES,
  selectedPo: ALL_PO,
  selectedStatuses: DEFAULT_PLANNED_STATUSES,
  numberQuery: "",
  sorter: { field: "startPlan", order: "descend" },
  modalDocId: false,
  isJournalOpen: false,
  sendStatus: { byGuid: {}, byNumber: {} },
  isSendStatusLoading: false,
  hasLoadedSendStatus: false,
  plannedTns: { data: [] },
  totalCount: 0,
  isLoadingPlannedTns: false,
  exportRange: null,
  isExporting: false,
  isExportModalOpen: false,
  lastDataKey: null,
  primaryDataRequestSeq: 0,
  sendStatusInFlight: false,

  // --- Сеттеры фильтров ---
  setDate: (v) => set({ date: v, pagination: { ...get().pagination, page: 1 } }),
  setSelectedBranch: (v) => set({ selectedBranch: v || ALL_BRANCHES, selectedPo: ALL_PO, pagination: { ...get().pagination, page: 1 } }),
  setSelectedPo: (v) => set({ selectedPo: v || ALL_PO, pagination: { ...get().pagination, page: 1 } }),
  setSelectedStatuses: (v) => set({ selectedStatuses: v || [], pagination: { ...get().pagination, page: 1 } }),
  setNumberQuery: (v) => set({ numberQuery: v, pagination: { ...get().pagination, page: 1 } }),
  setSorter: (v) => set({ sorter: v }),
  setPagination: (v) => set({ pagination: v }),
  setModalDocId: (v) => set({ modalDocId: v }),
  setIsJournalOpen: (v) => set({ isJournalOpen: v }),
  setExportRange: (v) => set({ exportRange: v }),
  setIsExportModalOpen: (v) => set({ isExportModalOpen: v }),

  // --- Сброс всех фильтров ---
  resetFilters: () => {
    set({
      date: null,
      selectedBranch: ALL_BRANCHES,
      selectedPo: ALL_PO,
      selectedStatuses: DEFAULT_PLANNED_STATUSES,
      numberQuery: "",
      pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE },
      lastDataKey: null,
    });
    get().loadSendStatus({ force: true });
  },

  // --- Обновление счётчиков ---
  updateTotalCount: () => {
    const sorted = get().getSortedRows();
    const startIndex = (get().pagination.page - 1) * get().pagination.pageSize;
    set({ totalCount: sorted.length });
    if (sorted.length > 0 && startIndex >= sorted.length) {
      set({ pagination: { ...get().pagination, page: 1 } });
    }
  },

  // --- Загрузка журнала отправок ---
  loadSendStatus: async ({ force = false } = {}) => {
    const state = get();
    if (state.sendStatusInFlight && !force) return;

    try {
      set({ sendStatusInFlight: true, isSendStatusLoading: true });
      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;
      const params = { "pagination[page]": 1, "pagination[pageSize]": 1, "sort[0]": "updatedAt:desc" };
      const { data: payload } = await axios.get(url, { params });
      const firstItem = Array.isArray(payload?.data) && payload.data.length > 0 ? payload.data[0] : null;
      let arr = firstItem?.attributes?.data ?? firstItem?.data ?? [];
      if (!Array.isArray(arr) && typeof arr === "string") arr = arr.split(/\r?\n/).filter(Boolean);
      set({ sendStatus: parseJournalStatuses(arr), hasLoadedSendStatus: true });
    } catch {
      set({ sendStatus: { byGuid: {}, byNumber: {} }, hasLoadedSendStatus: true });
    } finally {
      set({ sendStatusInFlight: false, isSendStatusLoading: false });
    }
  },

  // --- Загрузка плановых ТН из Strapi ---
  fetchPrimaryData: async ({ force = false } = {}) => {
    const state = get();
    const { date, selectedStatuses, numberQuery, primaryDataRequestSeq } = state;
    const key = buildPlannedDataKey({ date, statuses: selectedStatuses, numberQuery });
    if (!force && state.lastDataKey === key) return;

    const requestSeq = primaryDataRequestSeq + 1;
    set({ lastDataKey: key, primaryDataRequestSeq: requestSeq });

    if (getEffectiveStatuses(selectedStatuses).length === 0) {
      set({ plannedTns: { data: [] }, totalCount: 0, isLoadingPlannedTns: false });
      return;
    }

    try {
      set({ isLoadingPlannedTns: true });
      const jwt = localStorage.getItem("jwt");
      const base = `${import.meta.env.VITE_URL_BACKEND}/api/teh-narusheniyas`;
      const requestPageSize = DEFAULT_TNS_PAGE_SIZE;
      let requestPage = 1;
      let allItems = [];
      let total = 0;

      while (true) {
        const params = buildPrimaryRequestParams({ page: requestPage, pageSize: requestPageSize, date, statuses: selectedStatuses, numberQuery });
        const { data } = await axios.get(base, { params, headers: { Authorization: `Bearer ${jwt}` } });
        const list = Array.isArray(data?.data) ? data.data : [];
        total = data?.meta?.pagination?.total ?? list.length;
        allItems = allItems.concat(list);
        if (allItems.length >= total || list.length === 0) break;
        requestPage += 1;
      }

      if (get().primaryDataRequestSeq !== requestSeq) return;
      set({ plannedTns: { data: allItems } });
    } catch (error) {
      if (get().primaryDataRequestSeq !== requestSeq) return;
      console.log("Ошибка при получении плановых ТН", error);
      set({ plannedTns: { data: [] }, totalCount: 0 });
    } finally {
      if (get().primaryDataRequestSeq === requestSeq) set({ isLoadingPlannedTns: false });
    }
  },

  // --- Получение отфильтрованных строк ---
  getFilteredRows: () => {
    const { plannedTns, selectedStatuses, selectedBranch, selectedPo, sendStatus } = get();
    const rows = normalizePlannedRows(plannedTns);
    return filterPlannedRows({ rows, statuses: selectedStatuses, selectedBranch, selectedPo, sendStatus });
  },

  // --- Получение отсортированных строк ---
  getSortedRows: () => {
    return sortPlannedRows(get().getFilteredRows(), get().sorter);
  },

  // --- Получение страницы для таблицы ---
  getDataSource: () => {
    const sorted = get().getSortedRows();
    const { page, pageSize } = get().pagination;
    return sorted.slice((page - 1) * pageSize, page * pageSize);
  },

  // --- Подсчёт статистики ---
  getPlannedStats: () => buildPlannedStats(get().getFilteredRows()),

  // --- Экспорт в Excel ---
  fetchAllForExport: async () => {
    const { exportRange, sendStatus } = get();
    if (!exportRange || exportRange.length !== 2 || !exportRange[0] || !exportRange[1]) return { error: "Выберите период для экспорта" };

    try {
      set({ isExporting: true });
      const jwt = localStorage.getItem("jwt");
      const base = `${import.meta.env.VITE_URL_BACKEND}/api/teh-narusheniyas`;
      const [start, end] = exportRange;
      const startIso = new Date(start.year(), start.month(), start.date(), 0, 0, 0).toISOString();
      const endIso = new Date(end.year(), end.month(), end.date(), 23, 59, 59).toISOString();
      let allItems = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const params = {
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          "sort[0]": "createDateTime:DESC",
          "filters[BASE_TYPE][$eq]": 1,
          "filters[createDateTime][$gte]": startIso,
          "filters[createDateTime][$lte]": endIso,
        };
        const { data } = await axios.get(base, { params, headers: { Authorization: `Bearer ${jwt}` } });
        const list = Array.isArray(data?.data) ? data.data : [];
        allItems = allItems.concat(normalizePlannedRows({ data: list }));
        const total = data?.meta?.pagination?.total ?? 0;
        hasMore = page * pageSize < total && list.length > 0;
        page++;
      }

      return { items: allItems, sendStatus };
    } catch (err) {
      console.error("Ошибка экспорта:", err);
      return { error: "Ошибка при экспорте данных" };
    } finally {
      set({ isExporting: false });
    }
  },

  // --- Перезагрузка данных и журнала ---
  refreshAll: () => {
    set({ lastDataKey: null });
    get().fetchPrimaryData({ force: true });
    get().loadSendStatus({ force: true });
  },

  // --- Обновление после закрытия модалки ТН ---
  refreshAfterModal: () => {
    setTimeout(() => {
      set({ lastDataKey: null });
      get().fetchPrimaryData({ force: true });
      get().loadSendStatus({ force: true });
    }, 0);
  },
}));

export default usePlannedStore;
