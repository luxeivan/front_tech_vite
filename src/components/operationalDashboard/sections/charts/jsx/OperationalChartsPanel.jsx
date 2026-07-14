import React, { useMemo } from "react";
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
const CHART_PADDING = [30, 18, 48, 54];

const getYAxisTicks = (data) => {
  const maxValue = Math.max(0, ...data.map((item) => Number(item.value || 0)));
  const maxTick = Math.max(10, Math.ceil(maxValue / 10) * 10);
  return Array.from({ length: maxTick / 10 + 1 }, (_, index) => index * 10);
};

export default function OperationalChartsPanel() {
  const isStatsLoading = useOperationalDashboardStore((store) => store.isStatsLoading);
  const statsError = useOperationalDashboardStore((store) => store.statsError);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const rowsCurrentYear = useOperationalDashboardStore((store) => store.rowsCurrentYear);

  const chartData = useMemo(
    () => buildBranchTechViolationChartData(rowsCurrentYear),
    [rowsCurrentYear]
  );
  const totals = useMemo(() => getBranchChartTotals(chartData), [chartData]);
  const yAxisTicks = useMemo(() => getYAxisTicks(chartData), [chartData]);

  const config = {
    data: chartData,
    xField: "branch",
    yField: "value",
    colorField: "year",
    group: true,
    height: 245,
    padding: CHART_PADDING,
    legend: false,
    tooltip: false,
    scale: {
      color: {
        range: ["#b8cbe6", "#285a9c"],
      },
    },
    style: {
      maxWidth: 18,
    },
    label: {
      text: "value",
      position: "top",
      style: {
        fill: "#1f4f84",
        textAlign: "center",
        textBaseline: "bottom",
        dx: 0,
        dy: -6,
        fontSize: 11,
        fontWeight: 500,
      },
    },
    axis: {
      x: {
        title: false,
        labelFontSize: 10,
        labelFill: "#1575bc",
        labelFontWeight: 600,
        labelTransform: "rotate(0)",
      },
      y: {
        title: false,
        label: false,
        tickLength: 0,
        gridStroke: "#dfe9f4",
        gridStrokeOpacity: 0.9,
      },
    },
  };

  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--charts operational-charts-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-charts-panel__content">
          <h3 className="operational-charts-panel__title">{OPERATIONAL_CHART_TITLE}</h3>
          {statsError ? (
            <Alert type="warning" showIcon message={statsError} />
          ) : hasLoaded && isStatsLoading ? (
            <div className="operational-charts-panel__loading">
              <Spin size="large" />
            </div>
          ) : hasLoaded ? (
            <>
              <div className="operational-charts-panel__chart">
                <div className="operational-charts-panel__y-axis" aria-hidden="true">
                  {yAxisTicks.map((tick) => (
                    <span key={tick}>{formatNumber(tick)}</span>
                  ))}
                </div>
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
