import { create } from "zustand";
import axios from "axios";

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

const usePesDestinationsStore = create((set, get) => ({
  destinations: { assembly: [], tp: [] },
  tpHints: [],
  destinationType: "assembly",
  destinationId: undefined,
  loadingDestinations: false,
  loadingStartedAt: null,
  lastLoadMs: null,
  requestSeq: 0,

  setDestinationType: (value) => set({ destinationType: value }),
  setDestinationId: (value) => set({ destinationId: value }),

  // Загрузка точек сбора/ТП для выбранного режима и филиала.
  loadDestinations: async (mode, branch, destinationType, po) => {
    const nextSeq = get().requestSeq + 1;
    const startedAt = Date.now();
    set({
      requestSeq: nextSeq,
      destinationId: undefined,
      loadingDestinations: true,
      loadingStartedAt: startedAt,
    });

    try {
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/destinations`, {
        params: {
          mode,
          branch: branch || undefined,
          destinationType: destinationType || undefined,
          po: po || undefined,
        },
      });

      if (get().requestSeq !== nextSeq) return;

      const next = {
        assembly: Array.isArray(data?.assembly) ? data.assembly : [],
        tp: Array.isArray(data?.tp) ? data.tp : [],
      };
      const tpHints = Array.isArray(data?.tpHints) ? data.tpHints : [];

      const patch = { destinations: next, tpHints };
      if (mode === "multi") patch.destinationType = "assembly";
      patch.loadingDestinations = false;
      patch.loadingStartedAt = null;
      patch.lastLoadMs = Date.now() - startedAt;
      set(patch);
    } catch {
      if (get().requestSeq !== nextSeq) return;
      set({
        destinations: { assembly: [], tp: [] },
        tpHints: [],
        loadingDestinations: false,
        loadingStartedAt: null,
        lastLoadMs: Date.now() - startedAt,
      });
    }
  },
}));

export default usePesDestinationsStore;
