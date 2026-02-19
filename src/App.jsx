import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Button, Spin, Typography } from "antd";
import { useEffect, useState } from "react";
import Container from "./components/Container";
import useAuth from "./stores/useAuth";
import Header from "./components/Header";
import AuthForm from "./components/AuthForm";
import TableTN from "./components/main/TableTN";
import Dashboard from "./components/dashboard/Dashboard";
import Portal404 from "./components/Portal404/Portal404";
import PesModule from "./components/pes/jsx/PesModule";
import { logAuditBeacon, logAuditEvent } from "./utils/auditLogger";

function AuditTracker() {
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const isAuth = useAuth((s) => s.isAuth);

  useEffect(() => {
    if (!isAuth || !user) return;
    logAuditEvent(
      {
        page: location.pathname,
        action: "page_view",
        entity: "ui",
      },
      user
    );
  }, [isAuth, location.pathname, user?.username, user?.fullName, user?.view_role]);

  useEffect(() => {
    if (!isAuth || !user) return;
    const onBeforeUnload = () => {
      logAuditBeacon(
        {
          page: location.pathname,
          action: "page_leave",
          entity: "ui",
        },
        user
      );
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isAuth, location.pathname, user?.username, user?.fullName, user?.view_role]);

  return null;
}

function App() {
  const { authing, isAuth, exit, getJwt, fieldsSetting, getFieldsSetting } =
    useAuth((store) => store);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    Promise.resolve(getJwt()).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    getFieldsSetting();
  }, [isAuth]);

  const authOk = isAuth;
  const hasJwt = Boolean(localStorage.getItem("jwt"));

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

  return (
    <BrowserRouter>
      <AuditTracker />
      <Header />
      <Container>
        <Routes>
          {/* Главная: форма логина или таблица ТН */}
          <Route path="/" element={authOk ? <TableTN /> : <AuthForm />} />

          {/* Дашборд: защищённая страница */}
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />

          <Route
            path="/pes"
            element={
              <Protected>
                <PesModule />
              </Protected>
            }
          />

          {/* Фоллбек */}
          {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
          <Route path="*" element={<Portal404 />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;
