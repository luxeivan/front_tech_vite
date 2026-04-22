import React from "react";
import dayjs from "dayjs";
import { Layout, Space, Typography } from "antd";
import styles from "./Footer.module.css";

export default function Footer() {
  const currentYear = dayjs().year();

  return (
    <Layout.Footer className={styles.footer}>
      <Space size={8} align="center" wrap className={styles.row}>
        <Typography.Text type="secondary">АО «Мособлэнерго»</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        <Typography.Text type="secondary">Модуль коммуникаций и мониторинга отключений</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        <Typography.Text type="secondary">{`2025-${currentYear}`}</Typography.Text>
        <Typography.Text type="secondary">•</Typography.Text>
        {/* <Typography.Text type="secondary">
          Разработчик:{" "}
          <Typography.Link href="https://t.me/Stanislav_Yanut" target="_blank">
            Станислав Януть
          </Typography.Link>
        </Typography.Text> */}
      </Space>
    </Layout.Footer>
  );
}
