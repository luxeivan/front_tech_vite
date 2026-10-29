import { create } from "zustand";

// Фокус карты на одной ПЭС: клик по плитке «в пути» — на карте остаётся
// только она и рисуется маршрут до точки назначения.
const usePesMapFocusStore = create((set, get) => ({
  focusedItem: null,

  toggleFocus: (item) => {
    const cur = get().focusedItem;
    const same =
      cur &&
      String(cur?.number) === String(item?.number) &&
      String(cur?.id) === String(item?.id);
    set({ focusedItem: same ? null : item });
  },

  clearFocus: () => set({ focusedItem: null }),
}));

export default usePesMapFocusStore;
