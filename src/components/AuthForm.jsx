import React from "react";
import { Alert, Button, Form, Input, Typography } from "antd";
import useAuth from "../stores/useAuth";
import styles from "./AuthForm.module.css";

const { Title, Text } = Typography;

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
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <Title level={3} className={styles.title}>
            Вход в систему
          </Title>
          <Text type="secondary">Журнал технологических нарушений</Text>
        </div>

        <Form
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={() => errorMsg && setErrorMsg(null)}
          className={styles.form}
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
            <Input autoComplete="username" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
            help={errorMsg ? "Проверьте логин и пароль" : undefined}
            validateStatus={errorMsg ? "error" : ""}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>

          <Form.Item className={styles.submitRow}>
            <Button htmlType="submit" type="primary" loading={loading} block size="large">
              Войти
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
