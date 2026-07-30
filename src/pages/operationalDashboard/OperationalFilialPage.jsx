import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Spin } from "antd";

import OperationalMapPanel, {
  OperationalMapTopline,
} from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanel";
import OperationalDonutsPanel from "../../components/operationalDashboard/sections/donuts/jsx/OperationalDonutsPanel";
import OperationalDistrictsPanel from "../../components/operationalDashboard/sections/districts/jsx/OperationalDistrictsPanel";
import useOperationalDashboardStore from "../../stores/operationalDashboard/useOperationalDashboardStore";
import { getOperationalFilialRouteBySlug } from "../../utils/operationalFilialRoutes";
import "../../components/operationalDashboard/css/OperationalDashboard.css";
import "./OperationalFilialPage.css";

export default function OperationalFilialPage() {
  const { filialSlug } = useParams();
  const loadData = useOperationalDashboardStore((store) => store.loadData);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const filialRoute = getOperationalFilialRouteBySlug(filialSlug);
  const filialName = filialRoute?.name || "Филиал";

  useEffect(() => {
    if (!hasLoaded) {
      loadData({ includeStats: false });
    }
  }, [hasLoaded, loadData]);

  return (
    <section className="operational-dashboard operational-filial-page">
      <Spin fullscreen spinning={isLoading && !hasLoaded} />
      <header className="operational-filial-page__header">
        <div className="operational-filial-page__nav">
          <Link className="operational-filial-page__back" to="/dashboard-oo">
            назад
          </Link>
          <div className="operational-filial-page__filial-name">{filialName}</div>
        </div>
        <div className="operational-filial-page__heading">
          <h1 className="operational-dashboard__title operational-filial-page__title">
            ОПЕРАТИВНАЯ ОБСТАНОВКА
          </h1>
        </div>
        <OperationalMapTopline className="operational-filial-page__topline" />
      </header>
      <div className="operational-dashboard__grid operational-filial-page__grid">
        <OperationalDonutsPanel
          className="operational-filial-page__panel"
          filialName={filialName}
          groupBy="po"
        />
        <OperationalMapPanel
          filialName={filialName}
          enableFilialNavigation={false}
          fillGroup="po"
          hoverGroup="po"
          showDistrictLabels
          showPesMarkers
          showTopline={false}
          showMobileTopline
          variant="filial"
        />
        <OperationalDistrictsPanel
          className="operational-filial-page__panel"
          filialName={filialName}
          groupBy="po"
        />
        <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-filial-page__panel">
          <div className="operational-dashboard__panel-body" />
        </div>
      </div>
    </section>
  );
}
