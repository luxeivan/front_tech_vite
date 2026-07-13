import React from "react";

import { OPERATIONAL_DISTRICTS_PLACEHOLDER } from "../js/operationalDistrictsPanel.config";
import "../css/OperationalDistrictsPanel.css";

export default function OperationalDistrictsPanel() {
  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--districts operational-districts-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-dashboard__empty">{OPERATIONAL_DISTRICTS_PLACEHOLDER}</div>
      </div>
    </div>
  );
}
