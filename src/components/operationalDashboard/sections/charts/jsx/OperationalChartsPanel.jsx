import React, { useEffect, useMemo, useState } from "react";
import { Column } from "@ant-design/plots";
import { Alert, Spin } from "antd";

import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  OPERATIONAL_CHART_CURRENT_YEAR,
  OPERATIONAL_CHART_PREVIOUS_YEAR,
  OPERATIONAL_CHART_TITLE,
} from "../js/operationalChartsPanel.config";
import {
  buildBranchTechViolationChartData,
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

export default function OperationalChartsPanel() {
  const isStatsLoading = useOperationalDashboardStore((store) => store.isStatsLoading);
  const statsError = useOperationalDashboardStore((store) => store.statsError);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const hasStatsLoaded = useOperationalDashboardStore((store) => store.hasStatsLoaded);
  const rowsCurrentYear = useOperationalDashboardStore((store) => store.rowsCurrentYear);
  const statsMeta = useOperationalDashboardStore((store) => store.statsMeta);
  const isTabletLandscape = useTabletLandscape();

  const chartData = useMemo(
    () => buildBranchTechViolationChartData(rowsCurrentYear, statsMeta),
    [rowsCurrentYear, statsMeta]
  );
  const totals = useMemo(() => getBranchChartTotals(chartData), [chartData]);
  const statsDate = formatStatsDate(statsMeta?.calculatedAt);
  const nextRefresh = getNextRefreshText(statsMeta?.nextCalculatedAt);

  const config = {
    data: chartData,
    xField: "branch",
    yField: "value",
    colorField: "year",
    group: true,
    height: isTabletLandscape ? 188 : 210,
    padding: isTabletLandscape ? TABLET_LANDSCAPE_CHART_PADDING : CHART_PADDING,
    legend: false,
    tooltip: false,
    scale: {
      color: {
        range: ["#b8cbe6", "#285a9c"],
      },
    },
    style: {
      maxWidth: isTabletLandscape ? 14 : 18,
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
        dy: -6,
        fontSize: isTabletLandscape ? 9 : 11,
        fontWeight: 700,
      },
    },
    axis: {
      x: {
        title: false,
        labelFontSize: isTabletLandscape ? 8 : 10,
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
    <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-charts-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-charts-panel__content">
          <div className="operational-charts-panel__header">
            <h3 className="operational-charts-panel__title">{OPERATIONAL_CHART_TITLE}</h3>
            {/* Метка свежести данных пока скрыта, но оставлена для быстрого возврата.
            {statsDate ? (
              <div className="operational-charts-panel__meta">
                данные: {statsDate}
                {nextRefresh ? ` • след.: ${nextRefresh}` : ""}
              </div>
            ) : null} */}
          </div>
          {statsError ? (
            <Alert type="warning" showIcon message={statsError} />
          ) : hasLoaded && (isStatsLoading || !hasStatsLoaded) ? (
            <div className="operational-charts-panel__loading">
              <Spin size="large" />
            </div>
          ) : hasLoaded && hasStatsLoaded ? (
            <>
              <div className="operational-charts-panel__chart">
                <Column {...config} />
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
                  {totals.percent > 0 ? "+" : ""}
                  {formatNumber(totals.percent)}%
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
