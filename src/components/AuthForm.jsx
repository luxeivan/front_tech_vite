import React from "react";
import { Button, Form, Input, Alert } from "antd";
import useAuth from "../stores/useAuth";

export default function AuthForm() {
  const { authing } = useAuth((store) => store);
  const [errorMsg, setErrorMsg] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const onFinish = async (values) => {
    setErrorMsg(null);
    setLoading(true);

    const beforeJwt = localStorage.getItem("jwt") || "";

    try {
      await authing(values.identifier, values.password);

      const afterJwt = localStorage.getItem("jwt") || "";
      if (!afterJwt || afterJwt === beforeJwt) {
        setErrorMsg("Неверный логин или пароль");
      }
    } catch (_) {
      setErrorMsg("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        border: "1px solid #e5e7eb",
        padding: 20,
        borderRadius: 20,
      }}
    >
      <Form
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={() => errorMsg && setErrorMsg(null)}
      >
        {errorMsg && (
          <Alert
            type="error"
            showIcon
            message={errorMsg}
            style={{ marginBottom: 12 }}
          />
        )}

        <Form.Item
          name="identifier"
          label="Логин"
          rules={[{ required: true, message: "Введите логин" }]}
          validateStatus={errorMsg ? "error" : ""}
        >
          <Input autoComplete="username" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Пароль"
          rules={[{ required: true, message: "Введите пароль" }]}
          help={errorMsg ? "Проверьте логин и пароль" : undefined}
          validateStatus={errorMsg ? "error" : ""}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>

        <Form.Item>
          <Button htmlType="submit" type="primary" loading={loading} block>
            Вход
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
