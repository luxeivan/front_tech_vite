import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Button, Typography } from "antd";
import { useEffect, useState } from "react";
import Container from "./components/Container";
import useAuth from "./stores/useAuth";
import Header from "./components/Header";
import AuthForm from "./components/AuthForm";
import TableTN from "./components/main/TableTN";
import Dashboard from "./components/dashboard/Dashboard";
import Portal404 from "./components/Portal404/Portal404";

function App() {
  const { authing, isAuth, exit, getJwt, fieldsSetting, getFieldsSetting } =
    useAuth((store) => store);
  useEffect(() => {
    getJwt();
    getFieldsSetting();
  }, []);
  useEffect(() => {
    getFieldsSetting();
  }, [isAuth]);

  const authOk = isAuth || !!localStorage.getItem("jwt");

  return (
    <BrowserRouter>
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

          {/* Фоллбек */}
          {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
          <Route path="*" element={<Portal404 />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;
