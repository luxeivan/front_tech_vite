import axios from "axios";
import { create } from "zustand";

const urlBackend = import.meta.env.VITE_URL_BACKEND;

const useData = create((set) => ({
  tns: false,
  isLoadingTns: false,
  tn: false,
  isLoadingTn: false,
  isUpdatingTn: false,
  getTns: async () => {
    try {
      set({ isLoadingTns: true });
      const jwt = localStorage.getItem("jwt");
      const base = `${urlBackend}/api/teh-narusheniyas`;

      const SAFE_PAGE_LIMIT = 200; // защита от бесконечного цикла
      const REQ_SIZE = 100; // безопасный размер, не выше лимита Strapi

      const fetchPage = async (p, size) => {
        const { data } = await axios.get(base, {
          params: {
            "pagination[page]": p,
            "pagination[pageSize]": size,
            "sort[0]": "createDateTime:DESC",
          },
          headers: { Authorization: `Bearer ${jwt}` },
        });
        return data;
      };

      // 1) первая страница
      const first = await fetchPage(1, REQ_SIZE);
      const total = first?.meta?.pagination?.total ?? (Array.isArray(first?.data) ? first.data.length : 0);
      const effectiveSize = first?.meta?.pagination?.pageSize || Math.max(1, Math.min(REQ_SIZE, first?.data?.length || REQ_SIZE));

      let all = Array.isArray(first?.data) ? first.data.slice() : [];

      // 2) догружаем остальные, пока не наберём total
      let page = 2;
      while (all.length < total && page <= SAFE_PAGE_LIMIT) {
        const chunk = await fetchPage(page, effectiveSize);
        const arr = Array.isArray(chunk?.data) ? chunk.data : [];
        if (!arr.length) break; // ничего не пришло — выходим
        all.push(...arr);
        page += 1;
      }

      set({ tns: { data: all, meta: first?.meta }, isLoadingTns: false });
    } catch (error) {
      set({ isLoadingTns: false });
      console.log(`Ошибка при получении всех ТН`, error);
    }
  },
  
  
  // getTns: async (_page, pageSize = 500) => {
  //   try {
  //     set({ isLoadingTns: true });
  //     const jwt = localStorage.getItem("jwt");
  //     const base = `${urlBackend}/api/teh-narusheniyas`;

  //     const fetchPage = async (p) => {
  //       const { data } = await axios.get(base, {
  //         params: {
  //           "pagination[page]": p,
  //           // даже если Strapi отрежет до 100, мы просто пройдём по всем страницам
  //           "pagination[pageSize]": pageSize,
  //           "sort[0]": "createDateTime:DESC",
  //         },
  //         headers: { Authorization: `Bearer ${jwt}` },
  //       });
  //       return data;
  //     };

  //     const first = await fetchPage(1);
  //     const pageCount = first?.meta?.pagination?.pageCount || 1;
  //     let all = Array.isArray(first?.data) ? first.data.slice() : [];

  //     for (let p = 2; p <= pageCount; p++) {
  //       const chunk = await fetchPage(p);
  //       if (Array.isArray(chunk?.data)) all.push(...chunk.data);
  //     }

  //     set({ tns: { data: all, meta: first?.meta }, isLoadingTns: false });
  //   } catch (error) {
  //     set({ isLoadingTns: false });
  //     console.log(`Ошибка при получении всех ТН`, error);
  //   }
  // },

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

  //   getTns: async (page, pageSize) => {
  //     try {
  //       set({ isLoadingTns: true });
  //       const res = await axios.get(`${urlBackend}/api/teh-narusheniyas`, {
  //         params: {
  //           "pagination[page]": page,
  //           "pagination[pageSize]": pageSize,
  //           _: Date.now(), // 👈 cache-buster
  //         },
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem("jwt")}`,
  //           "Cache-Control": "no-cache", // 👈 просим не кэшировать
  //           Pragma: "no-cache",
  //         },
  //       });
  //       if (res.data) set({ tns: res.data, isLoadingTns: false });
  //     } catch (error) {
  //       set({ isLoadingTns: false });
  //       console.log(`Ошибка при получении всех ТН`, error);
  //     }
  //   },

  //   getTn: async (documentId) => {
  //     try {
  //       set({ isLoadingTn: true });
  //       const res = await axios.get(
  //         `${urlBackend}/api/teh-narusheniyas/${documentId}`,
  //         {
  //           params: { _: Date.now() }, // 👈 cache-buster
  //           headers: {
  //             Authorization: `Bearer ${localStorage.getItem("jwt")}`,
  //             "Cache-Control": "no-cache", // 👈 и тут
  //             Pragma: "no-cache",
  //           },
  //         }
  //       );
  //       if (res.data) set({ tn: res.data, isLoadingTn: false });
  //     } catch (error) {
  //       set({ isLoadingTn: false });
  //       console.log(`Ошибка при получении ТН ${documentId}`, error);
  //     }
  //   },

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
