import React from "react";
import LoggingPanel from "../../components/logging/jsx/LoggingPanel";
import styles from "./LoggingPage.module.css";

export default function LoggingPage() {
  return (
    <div className={styles.root}>
      <LoggingPanel />
    </div>
  );
}
