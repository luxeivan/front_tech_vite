import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "./stores/useAuth";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AuthForm from "./components/AuthForm";
import BrandSunLoader from "./components/ui/BrandSunLoader";
import DashboardPage from "./pages/dashboard/DashboardPage";
import OperationalDashboardPage from "./pages/operationalDashboard/OperationalDashboardPage";
import OperationalDashboardTestMapPage from "./pages/operationalDashboard/OperationalDashboardTestMapPage";
import OperationalFilialPage from "./pages/operationalDashboard/OperationalFilialPage";
import OperationalFilialTestMapPage from "./pages/operationalDashboard/OperationalFilialTestMapPage";
import Portal404 from "./components/Portal404/Portal404";
import PesPage from "./pages/pes/PesPage";
import PlannedPage from "./pages/planned/PlannedPage";
import EmergencyPage from "./pages/emergency/EmergencyPage";
import LoggingPage from "./pages/logging/LoggingPage";
import LoaderDemoPage from "./pages/loaderDemo/LoaderDemoPage";
import { hasFeatureAccess } from "./config/viewRoleAccess";
import PostAuthSplash from "./components/PostAuthSplash/PostAuthSplash";
import styles from "./AppLayout.module.css";

const DEFAULT_PAGE_TITLE = "Журнал ТН";
const PAGE_TITLES = [
  { match: (path) => path === "/", title: "Аварийные отключения" },
  { match: (path) => path.startsWith("/planned"), title: "Плановые отключения" },
  { match: (path) => path.startsWith("/dashboard-oo"), title: "Дашборд ОО" },
  { match: (path) => path.startsWith("/dashboard"), title: "Дашборд" },
  { match: (path) => path.startsWith("/pes"), title: "Модуль ПЭС" },
  { match: (path) => path.startsWith("/logging"), title: "Журнал действий" },
  { match: (path) => path.startsWith("/loader-demo"), title: "Демо лоадера" },
];

function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle =
      PAGE_TITLES.find((item) => item.match(location.pathname))?.title ||
      DEFAULT_PAGE_TITLE;
    document.title = pageTitle;
  }, [location.pathname]);

  return null;
}

function AuthCheckingLoader() {
  return (
    <div style={{ padding: 28, display: "flex", justifyContent: "center" }}>
      <BrandSunLoader size={48} text="Проверяем доступ" />
    </div>
  );
}

function App() {
  const { isAuth, getJwt, getFieldsSetting } =
    useAuth((store) => store);
  const user = useAuth((store) => store.user);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPostAuthSplash, setShowPostAuthSplash] = useState(false);
  useEffect(() => {
    Promise.resolve(getJwt()).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    if (isAuth) {
      getFieldsSetting();
    }
  }, [getFieldsSetting, isAuth]);
  useEffect(() => {
    if (!isAuth) {
      setShowPostAuthSplash(false);
      return;
    }

    const splashPending = sessionStorage.getItem("postAuthSplashPending") === "1";
    if (splashPending) {
      setShowPostAuthSplash(true);
    }
  }, [isAuth]);

  const authOk = isAuth;
  const hasJwt = Boolean(localStorage.getItem("jwt"));
  const handlePostAuthSplashDone = () => {
    sessionStorage.removeItem("postAuthSplashPending");
    setShowPostAuthSplash(false);
  };

  const Protected = ({ children }) => {
    // If the user opened a protected page directly, give getJwt() a moment to restore auth
    // instead of redirecting them to "/".
    if (!authChecked && hasJwt) {
      return <AuthCheckingLoader />;
    }
    if (!authOk) return <Navigate to="/" replace />;
    return children;
  };

  const FeatureOnly = ({ featureKey, children }) => {
    if (!hasFeatureAccess(user?.view_role, featureKey)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <RouteTitle />
      <div className={styles.appShell}>
        <Header />
        <main className={styles.main}>
          <Routes>
            {/* Главная: форма логина или таблица ТН */}
            <Route
              path="/"
              element={
                authOk ? (
                  showPostAuthSplash ? (
                    <PostAuthSplash onDone={handlePostAuthSplashDone} />
                  ) : (
                    <EmergencyPage />
                  )
                ) : !authChecked && hasJwt ? (
                  <AuthCheckingLoader />
                ) : (
                  <AuthForm />
                )
              }
            />

            {/* Дашборд: защищённая страница */}
          <Route
            path="/dashboard"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard-oo"
            element={
              <Protected>
                <OperationalDashboardTestMapPage basePath="/dashboard-oo" />
              </Protected>
            }
          />
          {/* <Route
            path="/dashboard-oo-test-map"
            element={
              <Protected>
                <OperationalDashboardPage />
              </Protected>
            }
          />
          <Route
            path="/dashboard-oo-test-map/:filialSlug"
            element={
              <Protected>
                <OperationalFilialPage basePath="/dashboard-oo-test-map" />
              </Protected>
            }
          />
          <Route
            path="/dashboard-oo-test-map/:filialSlug/:poSlug"
            element={
              <Protected>
                <OperationalFilialPage basePath="/dashboard-oo-test-map" />
              </Protected>
            }
          /> */}
          <Route
            path="/dashboard-oo/:filialSlug"
            element={
              <Protected>
                <OperationalFilialTestMapPage basePath="/dashboard-oo" />
              </Protected>
            }
          />
          <Route
            path="/dashboard-oo/:filialSlug/:poSlug"
            element={
              <Protected>
                <OperationalFilialTestMapPage basePath="/dashboard-oo" />
              </Protected>
            }
          />

            <Route
              path="/pes"
              element={
                <Protected>
                  <PesPage />
                </Protected>
              }
            />
            <Route
              path="/planned"
              element={
                <Protected>
                  <PlannedPage />
                </Protected>
              }
            />
            <Route
              path="/logging"
              element={
                <Protected>
                  <FeatureOnly featureKey="auditLogging">
                    <LoggingPage />
                  </FeatureOnly>
                </Protected>
              }
            />
            <Route path="/loader-demo" element={<LoaderDemoPage />} />

            {/* Фоллбек */}
            {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
            <Route path="*" element={<Portal404 />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;

//ПРОВЕРКА
