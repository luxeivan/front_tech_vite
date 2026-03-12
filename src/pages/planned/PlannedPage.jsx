import React from "react";
import PlannedTable from "../../components/planned/jsx/PlannedTable";
import PlannedSunStub from "../../components/planned/jsx/PlannedSunStub";
import styles from "./PlannedPage.module.css";

export default function PlannedPage() {
  return (
    <div className={styles.workRoot}>
      <PlannedSunStub />
      {/* <PlannedTable /> */}
    </div>
  );
}
