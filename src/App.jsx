import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Spin } from "antd";
import { useEffect, useState } from "react";
import useAuth from "./stores/useAuth";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AuthForm from "./components/AuthForm";
import DashboardPage from "./pages/dashboard/DashboardPage";
import Portal404 from "./components/Portal404/Portal404";
import PesPage from "./pages/pes/PesPage";
import PlannedPage from "./pages/planned/PlannedPage";
import EmergencyPage from "./pages/emergency/EmergencyPage";
import LoggingPage from "./pages/logging/LoggingPage";
import { hasFeatureAccess } from "./config/viewRoleAccess";
import PostAuthSplash from "./components/PostAuthSplash/PostAuthSplash";
import styles from "./AppLayout.module.css";

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
    getFieldsSetting();
  }, [isAuth]);
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
      return (
        <div style={{ padding: 28, display: "flex", justifyContent: "center" }}>
          <Spin size="large" />
        </div>
      );
    }
    if (!authOk) return <Navigate to="/" replace />;
    return children;
  };

  const PreviewOnly = ({ children }) => {
    if (!hasFeatureAccess(user?.view_role, "auditLogging")) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
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
                  <PreviewOnly>
                    <LoggingPage />
                  </PreviewOnly>
                </Protected>
              }
            />

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
