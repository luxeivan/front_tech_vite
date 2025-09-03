import { Button, Form, Input } from "antd";
import React from "react";
import useAuth from "../stores/useAuth";

export default function AuthForm() {
  const { authing } = useAuth((store) => store);
  const onFinish = (value) => {
    authing(value.identifier, value.password);
  };
  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        border: "1px solid gray",
        padding: 20,
        borderRadius: 20,
      }}
    >
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name={"identifier"} label={"Логин"}>
          <Input />
        </Form.Item>
        <Form.Item name={"password"} label={"Пароль"}>
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button htmlType="submit" type="primary">
            Вход
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
