import React from "react";
import dayjs from "dayjs";
import { Layout, Space, Typography } from "antd";

export default function Footer() {
  const currentYear = dayjs().year();

  return (
    <Layout.Footer
      style={{
        background: "#fff",
        borderTop: "1px solid #eaeaea",
        padding: "10px 16px",
      }}
    >
      <Space
        size={8}
        align="center"
        wrap
        style={{
          width: "100%",
          justifyContent: "center",
          color: "#6b778c",
          fontSize: 12,
          lineHeight: 1.2,
        }}
      >
        <Typography.Text type="secondary">АО «Мособлэнерго»</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        <Typography.Text type="secondary">Журнал технологических нарушений</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        <Typography.Text type="secondary">{`2025-${currentYear}`}</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        <Typography.Text type="secondary">
          Разработчик:{" "}
          <Typography.Link href="https://t.me/Stanislav_Yanut" target="_blank">
            Станислав Януть
          </Typography.Link>
        </Typography.Text>
      </Space>
    </Layout.Footer>
  );
}
