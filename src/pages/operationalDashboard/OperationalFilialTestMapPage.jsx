import React from "react";

import OperationalMapPanelTestMap from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanelTestMap";
import OperationalFilialPage from "./OperationalFilialPage";

export default function OperationalFilialTestMapPage() {
  return (
    <OperationalFilialPage
      MapPanelComponent={OperationalMapPanelTestMap}
      basePath="/dashboard-oo-test-map"
      pageClassName="operational-dashboard--test-map"
    />
  );
}
