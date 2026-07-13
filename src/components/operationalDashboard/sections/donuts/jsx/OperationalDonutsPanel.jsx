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

const getDurationChartData = (data) =>
  DURATION_DONUT_CONFIG.segments.map((segment) => ({
    type: segment.label,
    value: data?.values?.[segment.key] || 0,
    colorKey: segment.label,
    color: segment.color,
  }));

const getPopulationChartData = (data) => {
  const districts = data?.districts || [];
  if (districts.length) {
    return districts.map((item) => ({
      type: item.name,
      value: item.people,
      colorKey: item.name,
      color: getPopulationColor(item.people),
    }));
  }

  return POPULATION_DONUT_CONFIG.segments.map((segment) => ({
    type: segment.label,
    value: data?.values?.[segment.key] || 0,
    colorKey: segment.label,
    color: segment.color,
  }));
};

const getPieConfig = ({
  data,
  labelText,
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
        text: labelText,
        style: {
          fill: "#1575bc",
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
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

function DurationDonut({ data }) {
  const chartData = getDurationChartData(data);
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const config = getPieConfig({
    data: chartData,
    total,
    labelText: (datum) =>
      datum.value > 0
        ? `${datum.type}\n${formatNumber(datum.value)}`
        : "",
  });

  return (
    <div className="operational-donuts-panel__item">
      <h3 className="operational-donuts-panel__title">Количество аварийных отключений ЛЭП 3–20кВ</h3>
      <div className="operational-donuts-panel__chart">
        <Pie {...config} />
        <div className="operational-donuts-panel__center-number">
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

function PopulationDonut({ data }) {
  const chartData = getPopulationChartData(data);
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const config = getPieConfig({
    data: chartData,
    total,
    height: 300,
    radius: 0.72,
    labelPadding: [28, 128, 28, 128],
    labelPosition: "spider",
    labelText: (datum) =>
      datum.value > 0
        ? `${datum.type}\n${formatNumber(datum.value)} чел.`
        : "",
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

export default function OperationalDonutsPanel() {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const error = useOperationalDashboardStore((store) => store.error);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const durationData = useMemo(() => buildDurationDonutData(rows, now), [rows, now]);
  const populationData = useMemo(() => buildPopulationDonutData(rows), [rows]);

  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--donuts operational-donuts-panel">
      <div className="operational-dashboard__panel-body">
        {error ? (
          <Alert type="error" showIcon message={error} />
        ) : (
          <Spin spinning={isLoading}>
            <div className="operational-donuts-panel__grid">
              <DurationDonut data={durationData} />
              <PopulationDonut data={populationData} />
            </div>
          </Spin>
        )}
      </div>
    </div>
  );
}
