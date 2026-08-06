import React from "react";

import OperationalDashboardShell from "../../components/operationalDashboard/jsx/OperationalDashboardShell";
import OperationalMapPanelTestMap from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanelTestMap";

export default function OperationalDashboardTestMapPage({
  basePath = "/dashboard-oo-test-map",
}) {
  return (
    <OperationalDashboardShell
      MapPanelComponent={OperationalMapPanelTestMap}
      mapBasePath={basePath}
      className="operational-dashboard--test-map"
    />
  );
}
