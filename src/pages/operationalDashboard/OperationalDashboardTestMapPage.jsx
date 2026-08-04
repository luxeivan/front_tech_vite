import React from "react";

import OperationalDashboardShell from "../../components/operationalDashboard/jsx/OperationalDashboardShell";
import OperationalMapPanelTestMap from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanelTestMap";

export default function OperationalDashboardTestMapPage() {
  return (
    <OperationalDashboardShell
      MapPanelComponent={OperationalMapPanelTestMap}
      className="operational-dashboard--test-map"
    />
  );
}
