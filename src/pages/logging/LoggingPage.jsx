import React from "react";
import { Typography } from "antd";
import LoggingPanel from "../../components/logging/jsx/LoggingPanel";
import styles from "./LoggingPage.module.css";

export default function LoggingPage() {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Журнал действий
        </Typography.Title>
      </div>
      <LoggingPanel />
    </div>
  );
}
