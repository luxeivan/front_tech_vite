import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Button, Typography } from "antd";
import { useEffect, useState } from "react";
import Container from "./components/Container";
import useAuth from "./stores/useAuth";
import Header from "./components/Header";
import AuthForm from "./components/AuthForm";
import TableTN from "./components/main/TableTN";
import Dashboard from "./components/dashboard/Dashboard";
import Portal404 from "./components/Portal404/Portal404";
import PesModule from "./components/pes/PesModule";
import { logAuditBeacon, logAuditEvent } from "./utils/auditLogger";

function AuditTracker() {
  const location = useLocation();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    logAuditEvent(
      {
        page: location.pathname,
        action: "page_view",
        entity: "ui",
      },
      user
    );
  }, [location.pathname, user?.username, user?.fullName, user?.view_role]);

  useEffect(() => {
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
  }, [location.pathname, user?.username, user?.fullName, user?.view_role]);

  return null;
}

function App() {
  const { authing, isAuth, exit, getJwt, fieldsSetting, getFieldsSetting } =
    useAuth((store) => store);
  useEffect(() => {
    getJwt();
  }, []);
  useEffect(() => {
    getFieldsSetting();
  }, [isAuth]);

  const authOk = isAuth;

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
            element={authOk ? <Dashboard /> : <Navigate to="/" replace />}
          />


          <Route
            path="/pes"
            element={authOk ? <PesModule /> : <Navigate to="/" replace />}
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
