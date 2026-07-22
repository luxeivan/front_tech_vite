import React from "react";
import { Link, useParams } from "react-router-dom";

import OperationalMapPanel, {
  OperationalMapTopline,
} from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanel";
import { getOperationalFilialRouteBySlug } from "../../utils/operationalFilialRoutes";
import "../../components/operationalDashboard/css/OperationalDashboard.css";
import "./OperationalFilialPage.css";

export default function OperationalFilialPage() {
  const { filialSlug } = useParams();
  const filialRoute = getOperationalFilialRouteBySlug(filialSlug);
  const filialName = filialRoute?.name || "Филиал";

  return (
    <section className="operational-dashboard operational-filial-page">
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
        <div className="operational-dashboard__panel operational-dashboard__panel--donuts operational-filial-page__panel">
          <div className="operational-dashboard__panel-body" />
        </div>
        <OperationalMapPanel
          filialName={filialName}
          enableFilialNavigation={false}
          hoverGroup="po"
          showDistrictLabels
          showTopline={false}
          showMobileTopline
          variant="filial"
        />
        <div className="operational-dashboard__panel operational-dashboard__panel--districts operational-filial-page__panel">
          <div className="operational-dashboard__panel-body" />
        </div>
        <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-filial-page__panel">
          <div className="operational-dashboard__panel-body" />
        </div>
      </div>
    </section>
  );
}
