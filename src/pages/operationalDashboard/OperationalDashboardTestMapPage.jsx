import React from "react";

import OperationalDashboardShell from "../../components/operationalDashboard/jsx/OperationalDashboardShell";
import OperationalMapPanelTestMap from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanelTestMap";

export default function OperationalDashboardTestMapPage() {
  return (
    <OperationalDashboardShell
      MapPanelComponent={OperationalMapPanelTestMap}
      mapBasePath="/dashboard-oo-test-map"
      className="operational-dashboard--test-map"
    />
  );
}
