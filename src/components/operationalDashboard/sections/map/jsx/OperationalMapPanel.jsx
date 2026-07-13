import React from "react";

import { OPERATIONAL_MAP_PLACEHOLDER } from "../js/operationalMapPanel.config";
import "../css/OperationalMapPanel.css";

export default function OperationalMapPanel() {
  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--map operational-map-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-map-panel__surface">
          <span>{OPERATIONAL_MAP_PLACEHOLDER}</span>
        </div>
      </div>
    </div>
  );
}
