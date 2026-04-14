import axios from "axios";
import { create } from "zustand";
const urlBackend = import.meta.env.VITE_URL_BACKEND;

let axiosInterceptorsInstalled = false;

function installAxiosInterceptors() {
  if (axiosInterceptorsInstalled) return;

  // Подмешиваем JWT во все запросы автоматически
  axios.interceptors.request.use((config) => {
    const jwt = localStorage.getItem('jwt');
    if (jwt) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${jwt}`;
    } else if (config?.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  });

  // Глобально ловим 401 и сбрасываем авторизацию
  axios.interceptors.response.use(
    (resp) => resp,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        try {
          localStorage.removeItem('jwt');
          sessionStorage.removeItem("postAuthSplashPending");
          // Сбрасываем глобальное состояние авторизации —
          // роут "/" покажет AuthForm автоматически
          useAuth.setState({ isAuth: false, user: null, fieldsSetting: false });
        } catch (_) {
          // no-op
        }
      }
      return Promise.reject(error);
    }
  );

  axiosInterceptorsInstalled = true;
}

const useAuth = create((set) => ({
  isAuth: false,
  fieldsSetting: false,
  user: null,
  getJwt: async () => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      set({ isAuth: false, user: null });
      return null;
    }
    try {
      const r = await axios.get(`${urlBackend}/api/users/me`);
      // console.log('[auth] /users/me ->', r.data);
      set({ user: r.data, isAuth: true });
      return r.data;
    } catch (e) {
      console.log('[auth] /users/me error', e?.response?.data || e.message);
      localStorage.removeItem('jwt');
      set({ isAuth: false, user: null, fieldsSetting: false });
      return null;
    }
  },
  exit: () => {
    localStorage.removeItem("jwt");
    sessionStorage.removeItem("postAuthSplashPending");
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
        sessionStorage.setItem("postAuthSplashPending", "1");
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
      const r = await axios.get(`${urlBackend}/api/users/me`);
      // console.log('[auth] getUserMe ->', r.data);
      set({ user: r.data, isAuth: true });
      return r.data;
    } catch (e) {
      console.log('[auth] getUserMe error', e?.response?.data || e.message);
      localStorage.removeItem('jwt');
      set({ isAuth: false, user: null });
      return null;
    }
  },
  getFieldsSetting: async () => {
    try {
      // console.log(
      //   `${urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`
      // );

      const res = await axios.get(
        `${urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }
      );
      if (res.data) {
        // console.log(res.data);
        set((state) => ({ fieldsSetting: res.data.data }));
      }
    } catch (error) {
      console.log(error);
    }
  },
}));

installAxiosInterceptors();

export default useAuth;
