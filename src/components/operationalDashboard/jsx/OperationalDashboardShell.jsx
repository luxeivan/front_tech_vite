import React, { useEffect } from "react";

import OperationalChartsPanel from "../sections/charts/jsx/OperationalChartsPanel";
import OperationalDistrictsPanel from "../sections/districts/jsx/OperationalDistrictsPanel";
import OperationalDonutsPanel from "../sections/donuts/jsx/OperationalDonutsPanel";
import OperationalMapPanel from "../sections/map/jsx/OperationalMapPanel";
import useOperationalDashboardStore from "../../../stores/operationalDashboard/useOperationalDashboardStore";
import "../css/OperationalDashboard.css";

export default function OperationalDashboardShell() {
  const loadData = useOperationalDashboardStore((store) => store.loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <section className="operational-dashboard">
      <div className="operational-dashboard__grid">
        <OperationalDonutsPanel />
        <OperationalMapPanel />
        <OperationalDistrictsPanel />
        <OperationalChartsPanel />
      </div>
    </section>
  );
}
