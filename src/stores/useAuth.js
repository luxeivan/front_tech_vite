import axios from "axios";
import { create } from "zustand";
const urlBackend = import.meta.env.VITE_URL_BACKEND;

let axiosInterceptorsInstalled = false;

function isAuthSessionEndpoint(config = {}) {
  const requestUrl = String(config.url || "");
  const baseUrl = String(
    config.baseURL || (typeof window !== "undefined" ? window.location.origin : "http://localhost")
  );

  try {
    const url = new URL(requestUrl, baseUrl);
    return url.pathname === "/api/users/me" || url.pathname.startsWith("/api/auth/");
  } catch (_) {
    return requestUrl.includes("/api/users/me") || requestUrl.includes("/api/auth/");
  }
}

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

  // Сбрасываем авторизацию только когда 401 пришел от проверки сессии или auth endpoint.
  // Бизнес-запросы могут быть закрыты правами Strapi, но это не должно разлогинивать пользователя.
  axios.interceptors.response.use(
    (resp) => resp,
    (error) => {
      const status = error?.response?.status;
      if (status === 401 && isAuthSessionEndpoint(error?.config)) {
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
      const res = await axios.get(
        `${urlBackend}/api/nastrojki-polejs?pagination[pageSize]=100`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }
      );
      if (res.data) {
        const count = res.data.data?.length || 0;
        console.log(`[fieldsSetting] загружено ${count} записей из nastrojki-polejs`);
        set((state) => ({ fieldsSetting: res.data.data }));
      }
    } catch (error) {
      console.log(error);
    }
  },
}));

installAxiosInterceptors();

export default useAuth;
