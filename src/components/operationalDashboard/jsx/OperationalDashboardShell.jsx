import React, { useEffect, useState } from "react";

import OperationalChartsPanel from "../sections/charts/jsx/OperationalChartsPanel";
import OperationalDistrictsPanel from "../sections/districts/jsx/OperationalDistrictsPanel";
import OperationalDonutsPanel from "../sections/donuts/jsx/OperationalDonutsPanel";
import OperationalMapPanel, {
  OperationalMapTopline,
} from "../sections/map/jsx/OperationalMapPanel";
import BrandSunLoader from "../../ui/BrandSunLoader";
import useOperationalDashboardStore from "../../../stores/operationalDashboard/useOperationalDashboardStore";
import { TN_FILIALY_REZIM_UPDATED_EVENT } from "../../../utils/tnFilialyApi";
import "../css/OperationalDashboard.css";

const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;

const parseSsePayload = (event) => {
  try {
    return JSON.parse(event?.data || "{}");
  } catch {
    return null;
  }
};

const isFilialModeEvent = (payload) =>
  payload?.type === TN_FILIALY_REZIM_UPDATED_EVENT ||
  payload?.payload?.type === TN_FILIALY_REZIM_UPDATED_EVENT;

export default function OperationalDashboardShell({
  MapPanelComponent = OperationalMapPanel,
  mapBasePath = "/dashboard-oo",
  className = "",
}) {
  const loadData = useOperationalDashboardStore((store) => store.loadData);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const [hoveredBranchName, setHoveredBranchName] = useState("");

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!SERVICES_URL || typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }

    const eventUrl = `${String(SERVICES_URL).replace(/\/$/, "")}/services/event`;
    let eventSource = null;
    let reconnectTimer = null;
    let refreshTimer = null;
    let disposed = false;

    const scheduleRowsRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadData({ includeStats: false });
      }, 350);
    };

    const connect = () => {
      if (disposed) return;
      eventSource = new EventSource(eventUrl);

      eventSource.onmessage = (event) => {
        const payload = parseSsePayload(event);
        if (payload?.message === "Подключено к SSE") return;

        if (isFilialModeEvent(payload)) {
          window.dispatchEvent(new CustomEvent(TN_FILIALY_REZIM_UPDATED_EVENT));
        }

        scheduleRowsRefresh();
      };

      eventSource.onerror = () => {
        if (disposed) return;
        eventSource?.close();
        window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      eventSource?.close();
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(refreshTimer);
    };
  }, [loadData]);

  return (
    <section className={["operational-dashboard", className].filter(Boolean).join(" ")}>
      {isLoading && !hasLoaded ? (
        <BrandSunLoader fullscreen size={74} text="Загружаем оперативную обстановку" />
      ) : null}
      <header className="operational-dashboard__header">
        <h1 className="operational-dashboard__title">ОПЕРАТИВНАЯ ОБСТАНОВКА</h1>
        <OperationalMapTopline className="operational-dashboard__topline" />
      </header>
      <div className="operational-dashboard__grid">
        <OperationalDonutsPanel />
        <MapPanelComponent
          basePath={mapBasePath}
          externalHoverName={hoveredBranchName}
          showTopline={false}
        />
        <OperationalDistrictsPanel basePath={mapBasePath} onBranchHover={setHoveredBranchName} />
        <OperationalChartsPanel />
      </div>
    </section>
  );
}
