import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Spin } from "antd";
import { Pie } from "@ant-design/plots";

import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  DURATION_DONUT_CONFIG,
  POPULATION_DONUT_CONFIG,
} from "../js/operationalDonutsPanel.config";
import {
  buildDurationDonutData,
  buildPopulationDonutData,
  getPopulationColor,
} from "../js/operationalDonutsPanel.utils";
import "../css/OperationalDonutsPanel.css";

const formatNumber = (value) => Number(value || 0).toLocaleString("ru-RU");
const EMPTY_DONUT_SEGMENT = {
  type: "Нет данных",
  value: 1,
  colorKey: "Нет данных",
  color: "#d8e0ea",
  isEmpty: true,
};

const ensureDonutData = (items) => (items.length ? items : [EMPTY_DONUT_SEGMENT]);

const getDurationChartData = (data) =>
  ensureDonutData(
    DURATION_DONUT_CONFIG.segments
      .map((segment) => ({
        type: segment.label,
        value: data?.values?.[segment.key] || 0,
        colorKey: segment.label,
        color: segment.color,
      }))
      .filter((item) => item.value > 0)
  );

const getPopulationChartData = (data) => {
  const districts = data?.districts || [];
  if (districts.length) {
    return ensureDonutData(
      districts
        .map((item) => ({
          type: item.name,
          value: item.people,
          colorKey: item.name,
          color: getPopulationColor(item.people),
        }))
        .filter((item) => item.value > 0)
    );
  }

  return ensureDonutData(
    POPULATION_DONUT_CONFIG.segments
      .map((segment) => ({
        type: segment.label,
        value: data?.values?.[segment.key] || 0,
        colorKey: segment.label,
        color: segment.color,
      }))
      .filter((item) => item.value > 0)
  );
};

const getPieConfig = ({
  data,
  labelText,
  labelHeight,
  total,
  labelPadding,
  labelPosition = "outside",
  radius = 0.72,
  height = 270,
}) => ({
  data,
  angleField: "value",
  colorField: "colorKey",
  innerRadius: 0.62,
  radius,
  height,
  padding: labelPadding || [20, 100, 20, 100],
  legend: false,
  tooltip: false,
  label: labelText
    ? {
        position: labelPosition,
        offset: 14,
        labelHeight,
        text: labelText,
        style: {
          fill: "#1575bc",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 16,
        },
      }
    : false,
  scale: {
    color: {
      range: data.map((item) => item.color),
    },
  },
  style: {
    stroke: "#ffffff",
    lineWidth: 2,
  },
  statistic: {
    title: false,
    content: {
      style: {
        color: "#1575bc",
        fontSize: "46px",
        fontWeight: 400,
        lineHeight: "1",
      },
      formatter: () => formatNumber(total),
    },
  },
});

function DurationDonut({ data, groupBy = "filial" }) {
  const chartData = getDurationChartData(data);
  const total = Number(data?.total || 0);
  const hasValues = total > 0;
  const isFilialView = groupBy === "filial";
  const config = getPieConfig({
    data: chartData,
    total,
    height: isFilialView ? 238 : 270,
    radius: isFilialView ? 0.68 : 0.72,
    labelPadding: isFilialView ? [14, 108, 14, 108] : [20, 118, 20, 118],
    labelPosition: "spider",
    labelText: hasValues
      ? (datum) =>
          !datum.isEmpty && datum.value > 0
            ? `${datum.type}\n${formatNumber(datum.value)}`
            : ""
      : null,
  });

  return (
    <div className="operational-donuts-panel__item">
      <h3 className="operational-donuts-panel__title">Количество аварийных отключений ЛЭП</h3>
      <div className="operational-donuts-panel__chart">
        <Pie {...config} />
        <div className="operational-donuts-panel__center-number">
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

function PopulationDonut({ data, groupBy = "filial" }) {
  const chartData = getPopulationChartData(data);
  const total = Number(data?.total || 0);
  const hasValues = total > 0;
  const isFilialView = groupBy === "filial";
  const config = getPieConfig({
    data: chartData,
    total,
    height: isFilialView ? 238 : 270,
    radius: isFilialView ? 0.68 : 0.66,
    labelPadding: isFilialView ? [14, 116, 14, 116] : [18, 160, 54, 160],
    labelPosition: "spider",
    labelHeight: isFilialView ? undefined : 36,
    labelText: hasValues
      ? (datum) =>
          !datum.isEmpty && datum.value > 0
            ? `${datum.type}\n${formatNumber(datum.value)}`
            : ""
      : null,
  });

  return (
    <div className="operational-donuts-panel__item">
      <h3 className="operational-donuts-panel__title">Обесточено населения</h3>
      <div className="operational-donuts-panel__chart operational-donuts-panel__chart--population">
        <Pie {...config} />
        <div className="operational-donuts-panel__center-number">
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

export default function OperationalDonutsPanel({
  filialName = "",
  groupBy = "filial",
  className = "",
}) {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const error = useOperationalDashboardStore((store) => store.error);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const durationData = useMemo(
    () => buildDurationDonutData(rows, now, { filialName }),
    [rows, now, filialName]
  );
  const populationData = useMemo(
    () => buildPopulationDonutData(rows, { filialName, groupBy }),
    [rows, filialName, groupBy]
  );

  const panelClassName = [
    "operational-dashboard__panel",
    "operational-dashboard__panel--donuts",
    "operational-donuts-panel",
    groupBy === "filial" ? "operational-donuts-panel--filial" : "",
    groupBy === "po" ? "operational-donuts-panel--po" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName}>
      <div className="operational-dashboard__panel-body">
        {error ? (
          <Alert type="error" showIcon message={error} />
        ) : (
          <Spin spinning={isLoading && hasLoaded}>
            <div className="operational-donuts-panel__grid">
              <DurationDonut data={durationData} groupBy={groupBy} />
              <PopulationDonut data={populationData} groupBy={groupBy} />
            </div>
          </Spin>
        )}
      </div>
    </div>
  );
}
