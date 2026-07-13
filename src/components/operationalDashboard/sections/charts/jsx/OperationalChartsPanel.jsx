import React from "react";

import { OPERATIONAL_CHARTS_PLACEHOLDER } from "../js/operationalChartsPanel.config";
import "../css/OperationalChartsPanel.css";

export default function OperationalChartsPanel() {
  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-charts-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-dashboard__empty">{OPERATIONAL_CHARTS_PLACEHOLDER}</div>
      </div>
    </div>
  );
}
