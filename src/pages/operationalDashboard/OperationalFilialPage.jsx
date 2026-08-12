import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import OperationalNavigationSteps from "../../components/operationalDashboard/jsx/OperationalNavigationSteps";
import OperationalMapPanel, {
  OperationalMapTopline,
} from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanel";
import OperationalDonutsPanel from "../../components/operationalDashboard/sections/donuts/jsx/OperationalDonutsPanel";
import OperationalDistrictsPanel from "../../components/operationalDashboard/sections/districts/jsx/OperationalDistrictsPanel";
import OperationalChartsPanel from "../../components/operationalDashboard/sections/charts/jsx/OperationalChartsPanel";
import BrandSunLoader from "../../components/ui/BrandSunLoader";
import useOperationalDashboardStore from "../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  getOperationalFilialRouteBySlug,
  getOperationalPoSlug,
} from "../../utils/operationalFilialRoutes";
import {
  fetchTnFilialyRows,
  getTnFilialyAreaPoRows,
} from "../../utils/tnFilialyApi";
import "../../components/operationalDashboard/css/OperationalDashboard.css";
import "./OperationalFilialPage.css";

const normalizeFilialName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");

const getPoNameBySlug = (filialRows, filialName, poSlug) => {
  if (!poSlug) return "";
  const normalizedFilialName = normalizeFilialName(filialName);
  const filialRow = (Array.isArray(filialRows) ? filialRows : []).find(
    (row) => normalizeFilialName(row?.name) === normalizedFilialName
  );
  const poRows = getTnFilialyAreaPoRows(filialRow);

  return poRows.find((row) => getOperationalPoSlug(row?.name) === poSlug)?.name || "";
};

export default function OperationalFilialPage({
  MapPanelComponent = OperationalMapPanel,
  basePath = "/dashboard-oo",
  pageClassName = "",
}) {
  const { filialSlug, poSlug } = useParams();
  const loadData = useOperationalDashboardStore((store) => store.loadData);
  const reloadStats = useOperationalDashboardStore((store) => store.reloadStats);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const hasStatsLoaded = useOperationalDashboardStore((store) => store.hasStatsLoaded);
  const filialRoute = getOperationalFilialRouteBySlug(filialSlug);
  const filialName = filialRoute?.name || "Филиал";
  const [filialRows, setFilialRows] = useState([]);
  const [filialRowsLoading, setFilialRowsLoading] = useState(true);
  const [hoveredAreaName, setHoveredAreaName] = useState("");
  const poName = useMemo(
    () => getPoNameBySlug(filialRows, filialName, poSlug),
    [filialName, filialRows, poSlug]
  );
  const poTitle = poName || (poSlug ? "ПО" : "");
  const isPoLevel = Boolean(poSlug);
  const filialPath = `${basePath}/${filialSlug}`;
  const backPath = isPoLevel ? `${basePath}/${filialSlug}` : basePath;

  useEffect(() => {
    if (!hasLoaded) {
      loadData({ includeStats: !isPoLevel });
    }
  }, [hasLoaded, isPoLevel, loadData]);

  useEffect(() => {
    if (isPoLevel || !hasLoaded || hasStatsLoaded) return;
    reloadStats();
  }, [hasLoaded, hasStatsLoaded, isPoLevel, reloadStats]);

  useEffect(() => {
    let disposed = false;
    setFilialRowsLoading(true);
    fetchTnFilialyRows()
      .then((rows) => {
        if (!disposed) setFilialRows(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!disposed) setFilialRows([]);
      })
      .finally(() => {
        if (!disposed) setFilialRowsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const shouldShowInitialLoader = !hasLoaded || filialRowsLoading;

  if (shouldShowInitialLoader) {
    return (
      <section
        className={[
          "operational-dashboard",
          "operational-filial-page",
          isPoLevel ? "operational-filial-page--po" : "",
          pageClassName,
        ].filter(Boolean).join(" ")}
      >
        <BrandSunLoader fullscreen size={74} text="Загружаем оперативную обстановку" />
      </section>
    );
  }

  return (
    <section
      className={[
        "operational-dashboard",
        "operational-filial-page",
        isPoLevel ? "operational-filial-page--po" : "",
        pageClassName,
      ].filter(Boolean).join(" ")}
    >
      <header className="operational-filial-page__header">
        <div className="operational-filial-page__nav">
          <Link className="operational-filial-page__back" to={backPath}>
            назад
          </Link>
          <OperationalNavigationSteps
            basePath={basePath}
            filialPath={filialPath}
            filialName={filialName}
            poName={poTitle}
          />
        </div>
        <div className="operational-filial-page__heading">
          <h1 className="operational-dashboard__title operational-filial-page__title">
            ОПЕРАТИВНАЯ ОБСТАНОВКА
          </h1>
        </div>
        <OperationalMapTopline className="operational-dashboard__topline operational-filial-page__topline" />
      </header>
      <div className="operational-dashboard__grid operational-filial-page__grid">
        <OperationalDonutsPanel
          className="operational-filial-page__panel"
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          groupBy="po"
        />
        <MapPanelComponent
          basePath={basePath}
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          districtDetailMode={isPoLevel}
          enableFilialNavigation={!isPoLevel}
          externalHoverName={hoveredAreaName}
          fillGroup={isPoLevel ? "district" : "po"}
          hoverGroup={isPoLevel ? "none" : "po"}
          showDistrictLabels
          showPesMarkers
          showTopline={false}
          variant="filial"
        />
        <OperationalDistrictsPanel
          className="operational-filial-page__panel"
          basePath={basePath}
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          groupBy={isPoLevel ? "okrug" : "po"}
          onBranchHover={isPoLevel ? undefined : setHoveredAreaName}
        />
        {isPoLevel ? (
          <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-filial-page__panel">
            <div className="operational-dashboard__panel-body" />
          </div>
        ) : (
          <OperationalChartsPanel
            className="operational-filial-page__panel"
            filialName={filialName}
            filialRows={filialRows}
          />
        )}
      </div>
    </section>
  );
}
