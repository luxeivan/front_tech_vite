import React from "react";

import OperationalMapPanelTestMap from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanelTestMap";
import OperationalFilialPage from "./OperationalFilialPage";

export default function OperationalFilialTestMapPage({
  basePath = "/dashboard-oo-test-map",
}) {
  return (
    <OperationalFilialPage
      MapPanelComponent={OperationalMapPanelTestMap}
      basePath={basePath}
      pageClassName="operational-dashboard--test-map"
    />
  );
}
