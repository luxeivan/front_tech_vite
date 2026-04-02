import React from "react";
import PlannedTable from "../../components/planned/jsx/PlannedTable";
import PlannedSunStub from "../../components/planned/jsx/PlannedSunStub";
import useAuth from "../../stores/useAuth";
import { hasFeatureAccess } from "../../config/viewRoleAccess";
import styles from "./PlannedPage.module.css";

export default function PlannedPage() {
  const user = useAuth((store) => store.user);
  const canSeePlannedModule = hasFeatureAccess(user?.view_role, "plannedModule");

  return (
    <div className={styles.workRoot}>
      {canSeePlannedModule ? <PlannedTable /> : <PlannedSunStub />}
    </div>
  );
}
