import axios from "axios";
import { create } from "zustand";
const urlBackend = import.meta.env.VITE_URL_BACKEND;

const useAuth = create((set) => ({
  isAuth: false,
  fieldsSetting: false,
  user: null,
  getJwt: () => {
    const jwt = localStorage.getItem("jwt");
    if (jwt) {
      set({ isAuth: true });
      axios
        .get(`${urlBackend}/api/users/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        })
        .then((r) => {
          console.log('[auth] /users/me ->', r.data);
          set({ user: r.data });
        })
        .catch((e) => {
          console.log('[auth] /users/me error', e?.response?.data || e.message);
        });
      return jwt;
    } else {
      set({ isAuth: false });
    }
  },
  exit: () => {
    localStorage.removeItem("jwt");
    set({ isAuth: false, user: null, fieldsSetting: false });
  },
  authing: async (identifier, password) => {
    try {
      const res = await axios.post(`${urlBackend}/api/auth/local`, {
        identifier,
        password,
      });
      if (res.data) {
        console.log(res.data);
        localStorage.setItem("jwt", res.data.jwt);
        console.log('[auth] login ok ->', res.data);
        set({ user: res.data.user });
        set((state) => ({ isAuth: true }));
      }
    } catch (error) {
      console.log(error);
    }
  },
  getUserMe: async () => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) return null;
    try {
      const r = await axios.get(`${urlBackend}/api/users/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      console.log('[auth] getUserMe ->', r.data);
      set({ user: r.data, isAuth: true });
      return r.data;
    } catch (e) {
      console.log('[auth] getUserMe error', e?.response?.data || e.message);
      return null;
    }
  },
  getFieldsSetting: async () => {
    try {
      console.log(
        `${urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`
      );

      const res = await axios.get(
        `${urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }
      );
      if (res.data) {
        console.log(res.data);
        set((state) => ({ fieldsSetting: res.data.data }));
      }
    } catch (error) {
      console.log(error);
    }
  },
}));

export default useAuth;
