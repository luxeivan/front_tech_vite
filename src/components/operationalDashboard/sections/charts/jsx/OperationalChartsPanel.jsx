import React, { useEffect, useMemo, useRef, useState } from "react";
import { Column } from "@ant-design/plots";
import { Alert } from "antd";

import BrandSunLoader from "../../../../ui/BrandSunLoader";
import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  OPERATIONAL_CHART_CURRENT_YEAR,
  OPERATIONAL_CHART_PREVIOUS_YEAR,
  OPERATIONAL_CHART_TITLE_PREFIX,
} from "../js/operationalChartsPanel.config";
import {
  buildBranchTechViolationChartData,
  buildPoTechViolationChartData,
  getBranchChartTotals,
} from "../js/operationalChartsPanel.utils";
import "../css/OperationalChartsPanel.css";

const formatNumber = (value) => Number(value || 0).toLocaleString("ru-RU");
const CHART_PADDING = [24, 16, 38, 16];
const TABLET_LANDSCAPE_CHART_PADDING = [18, 8, 44, 8];

const useTabletLandscape = () => {
  const getValue = () =>
    typeof window !== "undefined" &&
    window.innerWidth >= 901 &&
    window.innerWidth <= 1200 &&
    window.innerWidth > window.innerHeight;

  const [isTabletLandscape, setIsTabletLandscape] = useState(getValue);

  useEffect(() => {
    const handleResize = () => setIsTabletLandscape(getValue());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isTabletLandscape;
};

const useWallDisplay = () => {
  const getValue = () =>
    typeof window !== "undefined" &&
    window.innerWidth === 3840 &&
    window.innerHeight === 2160;

  const [isWallDisplay, setIsWallDisplay] = useState(getValue);

  useEffect(() => {
    const handleResize = () => setIsWallDisplay(getValue());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isWallDisplay;
};

const formatStatsDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getNextRefreshText = (value) => {
  if (!value) return null;
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  if (diffMs <= 0) return "скоро";

  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `через ${minutes} мин`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `через ${hours} ч ${restMinutes} мин` : `через ${hours} ч`;
};

export default function OperationalChartsPanel({
  className = "",
  filialName = "",
  filialRows = [],
  poName = "",
  poSlug = "",
}) {
  const isStatsLoading = useOperationalDashboardStore((store) => store.isStatsLoading);
  const statsError = useOperationalDashboardStore((store) => store.statsError);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const hasStatsLoaded = useOperationalDashboardStore((store) => store.hasStatsLoaded);
  const rowsCurrentYear = useOperationalDashboardStore((store) => store.rowsCurrentYear);
  const rowsCurrentYearByPo = useOperationalDashboardStore((store) => store.rowsCurrentYearByPo);
  const statsMeta = useOperationalDashboardStore((store) => store.statsMeta);
  const reloadStats = useOperationalDashboardStore((store) => store.reloadStats);
  const isTabletLandscape = useTabletLandscape();
  const isWallDisplay = useWallDisplay();
  const isPoChart = Boolean(filialName);
  const requestedPoStatsRefreshRef = useRef(false);
  const hasPoStats =
    (Array.isArray(rowsCurrentYearByPo) && rowsCurrentYearByPo.length > 0) ||
    statsMeta?.hasPoRows === true;

  useEffect(() => {
    if (!isPoChart || !hasLoaded || !hasStatsLoaded || isStatsLoading || hasPoStats) return;
    if (requestedPoStatsRefreshRef.current) return;

    requestedPoStatsRefreshRef.current = true;
    reloadStats({ forceRefresh: true });
  }, [
    hasLoaded,
    hasPoStats,
    hasStatsLoaded,
    isPoChart,
    isStatsLoading,
    reloadStats,
  ]);

  const chartData = useMemo(
    () =>
      isPoChart
        ? buildPoTechViolationChartData({
          filialName,
          filialRows,
          poName,
          poSlug,
          rowsCurrentYearByPo,
          statsMeta,
        })
        : buildBranchTechViolationChartData(rowsCurrentYear, statsMeta),
    [filialName, filialRows, isPoChart, poName, poSlug, rowsCurrentYear, rowsCurrentYearByPo, statsMeta]
  );
  const chartBranchCount = useMemo(
    () => new Set(chartData.map((item) => item.branch)).size,
    [chartData]
  );
  const isSparseChart = chartBranchCount > 0 && chartBranchCount <= 2;
  const totals = useMemo(() => getBranchChartTotals(chartData), [chartData]);
  const chartTitle = `${OPERATIONAL_CHART_TITLE_PREFIX} ${statsMeta?.periodLabel || "за 6 месяцев"}`;
  const statsDate = formatStatsDate(statsMeta?.calculatedAt);
  const nextRefresh = getNextRefreshText(statsMeta?.nextCalculatedAt);
  const shouldShowLoader = hasLoaded && !isPoChart && (isStatsLoading || !hasStatsLoaded);

  const config = {
    data: chartData,
    xField: "branch",
    yField: "value",
    colorField: "year",
    group: true,
    height: isWallDisplay ? 420 : isTabletLandscape ? 188 : 210,
    padding: isWallDisplay
      ? [42, 26, 72, 26]
      : isTabletLandscape
        ? TABLET_LANDSCAPE_CHART_PADDING
        : CHART_PADDING,
    legend: false,
    tooltip: false,
    scale: {
      color: {
        range: ["#b8cbe6", "#285a9c"],
      },
    },
    style: {
      maxWidth: isWallDisplay ? 34 : isTabletLandscape ? 14 : 18,
    },
    label: {
      text: "value",
      position: "top",
      style: {
        fill: "#0072c6",
        fillOpacity: 1,
        textAlign: "center",
        textBaseline: "bottom",
        dx: 0,
        dy: isWallDisplay ? -12 : -6,
        fontSize: isWallDisplay ? 20 : isTabletLandscape ? 9 : 11,
        fontWeight: 700,
      },
    },
    axis: {
      x: {
        title: false,
        labelFontSize: isWallDisplay ? 18 : isTabletLandscape ? 8 : 10,
        labelFill: "#0072c6",
        labelFillOpacity: 1,
        labelOpacity: 1,
        labelFontWeight: 700,
        labelTransform: isTabletLandscape ? "rotate(-18)" : "rotate(0)",
      },
      y: {
        title: false,
        label: false,
        tickLength: 0,
        gridStroke: "#c6d6e5",
        gridStrokeOpacity: 0.85,
        gridLineWidth: 1,
      },
    },
  };

  return (
    <div
      className={[
        "operational-dashboard__panel",
        "operational-dashboard__panel--charts",
        "operational-charts-panel",
        className,
      ].filter(Boolean).join(" ")}
    >
      <div className="operational-dashboard__panel-body">
        <div className="operational-charts-panel__content">
          <div className="operational-charts-panel__header">
            <h3 className="operational-charts-panel__title">{chartTitle}</h3>
            {/* Метка свежести данных пока скрыта, но оставлена для быстрого возврата.
            {statsDate ? (
              <div className="operational-charts-panel__meta">
                данные: {statsDate}
                {nextRefresh ? ` • след.: ${nextRefresh}` : ""}
              </div>
            ) : null} */}
          </div>
          {statsError && !isPoChart ? (
            <Alert type="warning" showIcon message={statsError} />
          ) : shouldShowLoader ? (
            <div className="operational-charts-panel__loading">
              <BrandSunLoader size={46} text="Загружаем статистику" />
            </div>
          ) : hasLoaded && (hasStatsLoaded || isPoChart) ? (
            <>
              <div
                className={[
                  "operational-charts-panel__chart",
                  isSparseChart ? "operational-charts-panel__chart--sparse" : "",
                ].filter(Boolean).join(" ")}
              >
                <div className="operational-charts-panel__chart-inner">
                  <Column {...config} />
                </div>
              </div>
              <div className="operational-charts-panel__summary">
                <div className="operational-charts-panel__summary-values">
                  <div className="operational-charts-panel__summary-item">
                    <span className="operational-charts-panel__legend-dot operational-charts-panel__legend-dot--previous" />
                    <span>{OPERATIONAL_CHART_PREVIOUS_YEAR}</span>
                    <strong>{formatNumber(totals.previous)}</strong>
                  </div>
                  <div className="operational-charts-panel__summary-item">
                    <span className="operational-charts-panel__legend-dot operational-charts-panel__legend-dot--current" />
                    <span>{OPERATIONAL_CHART_CURRENT_YEAR}</span>
                    <strong>{formatNumber(totals.current)}</strong>
                  </div>
                </div>
                <div className="operational-charts-panel__summary-percent">
                  {totals.percent > 0 ? "↑ " : totals.percent < 0 ? "↓ " : ""}
                  {formatNumber(Math.abs(totals.percent))}%
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
