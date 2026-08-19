import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Spin } from "antd";
import { Pie } from "@ant-design/plots";

import BrandSunLoader from "../../../../ui/BrandSunLoader";
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

const wrapDonutLabelName = (value, maxLineLength = 13) => {
  const label = String(value || "").trim();
  if (!label) return "";
  if (label.includes("-")) return label.replace(/-/g, "-\n");
  if (label.length <= maxLineLength) return label;

  const lines = [];
  let currentLine = "";
  label.split(" ").forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLineLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
};

const formatDonutLabel = (name, value, maxLineLength) =>
  `${wrapDonutLabelName(name, maxLineLength)}\n${formatNumber(value)}`;

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
  innerRadius = 0.62,
  radius = 0.72,
  height = 270,
  labelFontSize = 11,
  labelOffset = 14,
}) => ({
  data,
  angleField: "value",
  colorField: "colorKey",
  innerRadius,
  radius,
  height,
  padding: labelPadding || [20, 100, 20, 100],
  legend: false,
  tooltip: false,
  label: labelText
    ? {
        position: labelPosition,
        offset: labelOffset,
        labelHeight,
        text: labelText,
        style: {
          fill: "#1575bc",
          fontSize: labelFontSize,
          fontWeight: 600,
          lineHeight: labelFontSize + 4,
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
  statistic: false,
});

function DurationDonut({ data, groupBy = "filial", compact = false, isWallDisplay = false }) {
  const chartData = getDurationChartData(data);
  const total = Number(data?.total || 0);
  const hasValues = total > 0;
  const isFilialView = groupBy === "filial" || groupBy === "po" || groupBy === "okrug";
  const chartHeight = isWallDisplay
    ? compact
      ? 380
      : isFilialView
        ? 430
        : 500
    : compact
      ? 218
      : isFilialView
        ? 238
        : 270;
  const config = getPieConfig({
    data: chartData,
    total,
    height: chartHeight,
    innerRadius: compact ? 0.66 : 0.62,
    radius: isWallDisplay
      ? compact
        ? 0.72
        : isFilialView
          ? 0.66
          : 0.68
      : compact
        ? 0.76
        : isFilialView
          ? 0.68
          : 0.72,
    labelPadding: isWallDisplay
      ? compact
        ? [16, 118, 16, 118]
        : isFilialView
          ? [26, 204, 26, 204]
          : [34, 224, 34, 224]
      : compact
        ? [8, 56, 8, 56]
        : isFilialView
          ? [14, 108, 14, 108]
          : [20, Math.max(40, Math.min(118, window.innerWidth * 0.1)), 20, Math.max(40, Math.min(118, window.innerWidth * 0.1))],
    labelPosition: "spider",
    labelFontSize: isWallDisplay ? (compact ? 16 : 20) : compact ? 9 : 11,
    labelOffset: isWallDisplay ? (compact ? 16 : 24) : compact ? 8 : 14,
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
        <div
          className={[
            "operational-donuts-panel__center-number",
            compact ? "operational-donuts-panel__center-number--compact" : "",
          ].filter(Boolean).join(" ")}
        >
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

function PopulationDonut({ data, groupBy = "filial", compact = false, isWallDisplay = false }) {
  const chartData = getPopulationChartData(data);
  const total = Number(data?.total || 0);
  const hasValues = total > 0;
  const isFilialView = groupBy === "filial" || groupBy === "po" || groupBy === "okrug";
  const chartHeight = isWallDisplay
    ? compact
      ? 380
      : isFilialView
        ? 430
        : 500
    : compact
      ? 218
      : isFilialView
        ? 238
        : 270;
  const config = getPieConfig({
    data: chartData,
    total,
    height: chartHeight,
    innerRadius: compact ? 0.66 : isFilialView ? 0.62 : 0.56,
    radius: isWallDisplay
      ? compact
        ? 0.72
        : isFilialView
          ? 0.64
          : 0.62
      : compact
        ? 0.76
        : isFilialView
          ? 0.68
          : 0.66,
    labelPadding: isWallDisplay
      ? compact
        ? [16, 142, 16, 142]
        : isFilialView
          ? [26, 250, 26, 250]
          : [34, 290, 88, 290]
      : compact
        ? [8, 72, 8, 72]
        : isFilialView
          ? [14, 140, 14, 140]
          : [18, Math.max(40, Math.min(160, window.innerWidth * 0.12)), 54, Math.max(40, Math.min(160, window.innerWidth * 0.12))],
    labelPosition: "spider",
    labelHeight: isWallDisplay
      ? isFilialView
        ? compact
          ? 50
          : 62
        : 66
      : isFilialView
        ? compact
          ? 28
          : 34
        : 36,
    labelFontSize: isWallDisplay ? (compact ? 16 : 20) : compact ? 9 : 11,
    labelOffset: isWallDisplay ? (compact ? 16 : 24) : compact ? 8 : 14,
    labelText: hasValues
      ? (datum) =>
          !datum.isEmpty && datum.value > 0
            ? formatDonutLabel(datum.type, datum.value, compact ? 10 : 13)
            : ""
      : null,
  });

  return (
    <div className="operational-donuts-panel__item">
      <h3 className="operational-donuts-panel__title">Обесточено населения</h3>
      <div className="operational-donuts-panel__chart operational-donuts-panel__chart--population">
        <Pie {...config} />
        <div
          className={[
            "operational-donuts-panel__center-number",
            compact ? "operational-donuts-panel__center-number--compact" : "",
          ].filter(Boolean).join(" ")}
        >
          {formatNumber(total)}
        </div>
      </div>
    </div>
  );
}

export default function OperationalDonutsPanel({
  filialName = "",
  groupBy = "filial",
  poName = "",
  poSlug = "",
  className = "",
}) {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const error = useOperationalDashboardStore((store) => store.error);
  const [now, setNow] = useState(() => dayjs());
  const isTabletLandscape = useTabletLandscape();
  const isWallDisplay = useWallDisplay();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const durationData = useMemo(
    () => buildDurationDonutData(rows, now, { filialName, poName, poSlug }),
    [rows, now, filialName, poName, poSlug]
  );
  const populationData = useMemo(
    () => buildPopulationDonutData(rows, { filialName, groupBy, poName, poSlug }),
    [rows, filialName, groupBy, poName, poSlug]
  );

  const panelClassName = [
    "operational-dashboard__panel",
    "operational-dashboard__panel--donuts",
    "operational-donuts-panel",
    groupBy === "filial" ? "operational-donuts-panel--filial" : "",
    groupBy === "po" || groupBy === "okrug" ? "operational-donuts-panel--po" : "",
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
          <Spin
            spinning={isLoading && hasLoaded}
            indicator={<BrandSunLoader size={34} />}
          >
            <div className="operational-donuts-panel__grid">
              <DurationDonut
                data={durationData}
                groupBy={groupBy}
                compact={isTabletLandscape}
                isWallDisplay={isWallDisplay}
              />
              <PopulationDonut
                data={populationData}
                groupBy={groupBy}
                compact={isTabletLandscape}
                isWallDisplay={isWallDisplay}
              />
            </div>
          </Spin>
        )}
      </div>
    </div>
  );
}
