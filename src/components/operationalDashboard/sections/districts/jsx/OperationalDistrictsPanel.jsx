import React, { useEffect, useMemo, useState } from "react";
import { Table } from "antd";
import { Link } from "react-router-dom";
import axios from "axios";

import BrandSunLoader from "../../../../ui/BrandSunLoader";
import useAuth from "../../../../../stores/useAuth";
import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import usePesModuleDataStore from "../../../../../stores/pes/usePesModuleDataStore";
import { fetchTnFilialyRows, fetchTnPoOkrugLinkRows } from "../../../../../utils/tnFilialyApi";
import {
  getOperationalFilialPathForBase,
  getOperationalPoPath,
} from "../../../../../utils/operationalFilialRoutes";
import { OPERATIONAL_BRANCH_COLUMNS } from "../js/operationalDistrictsPanel.config";
import {
  buildPesDashboardCountMaps,
  buildOperationalBranchRows,
  buildOperationalBranchSummary,
  buildOperationalOkrugSummary,
  buildOperationalOkrugRows,
  buildOperationalPoRows,
} from "../js/operationalDistrictsPanel.utils";
import "../css/OperationalDistrictsPanel.css";

const formatCellValue = (value) =>
  typeof value === "number" ? new Intl.NumberFormat("ru-RU").format(value) : value;

const renderBranchLink = (branch, children, eventHandlers = {}, basePath = "/dashboard-oo") => {
  const path = getOperationalFilialPathForBase(`${branch} филиал`, basePath);
  return path ? (
    <Link className="operational-districts-panel__branch-link" to={path} {...eventHandlers}>
      {children}
    </Link>
  ) : (
    <span {...eventHandlers}>{children}</span>
  );
};

const renderPoLink = (
  filialName,
  poName,
  children,
  eventHandlers = {},
  basePath = "/dashboard-oo"
) => {
  const path = getOperationalPoPath(filialName, poName, basePath);
  return path ? (
    <Link className="operational-districts-panel__branch-link" to={path} {...eventHandlers}>
      {children}
    </Link>
  ) : (
    <span {...eventHandlers}>{children}</span>
  );
};

const OPERATIONAL_BRANCH_TABLE_SCROLL_X = OPERATIONAL_BRANCH_COLUMNS.reduce(
  (sum, column) => sum + Number(column.width || 0),
  0
);

const OPERATIONAL_FILIAL_COLUMN_WIDTHS = {
  branch: 108,
  lep: 34,
  tpRp: 38,
  population: 50,
  mkd: 34,
  boilerCtp: 44,
  vzuVns: 42,
  kns: 34,
  medical: 56,
  schools: 52,
  brigades: 42,
  staff: 44,
  vehicles: 42,
  pes: 34,
  mainResource: 48,
  ovb: 34,
};

const OPERATIONAL_PO_COLUMN_WIDTHS = {
  branch: 120,
  lep: 36,
  tpRp: 40,
  population: 52,
  mkd: 36,
  boilerCtp: 48,
  vzuVns: 46,
  kns: 36,
  medical: 60,
  schools: 56,
  brigades: 46,
  staff: 46,
  vehicles: 46,
  pes: 36,
  mainResource: 50,
  ovb: 36,
};

const PES_DASHBOARD_POLL_MS = 10000;

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

const fetchPesAssemblyDestinations = async () => {
  const base = getBackendBase();
  const { data } = await axios.get(`${base}/services/pes/module/destinations`, {
    params: { destinationType: "assembly" },
  });
  return Array.isArray(data?.assembly) ? data.assembly : [];
};

export default function OperationalDistrictsPanel({
  className = "",
  basePath = "/dashboard-oo",
  filialName = "",
  groupBy = "filial",
  poName = "",
  poSlug = "",
  onBranchHover,
}) {
  const user = useAuth((store) => store.user);
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const pesItems = usePesModuleDataStore((store) => store.items);
  const loadPesItems = usePesModuleDataStore((store) => store.loadItems);
  const [filialRows, setFilialRows] = useState([]);
  const [poOkrugLinkRows, setPoOkrugLinkRows] = useState([]);
  const [pesAssemblyDestinations, setPesAssemblyDestinations] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetchTnFilialyRows()
      .then((nextRows) => {
        if (!cancelled) setFilialRows(nextRows);
      })
      .catch(() => {
        if (!cancelled) setFilialRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (groupBy !== "po" && groupBy !== "okrug") {
      setPoOkrugLinkRows([]);
      return () => {
        cancelled = true;
      };
    }

    fetchTnPoOkrugLinkRows()
      .then((nextRows) => {
        if (!cancelled) setPoOkrugLinkRows(nextRows);
      })
      .catch((error) => {
        console.warn(
          "[dashboard-oo] Не удалось загрузить tn-po-okrug-links для сводной таблицы",
          error?.message || error
        );
        if (!cancelled) setPoOkrugLinkRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [groupBy]);

  useEffect(() => {
    let cancelled = false;

    fetchPesAssemblyDestinations()
      .then((nextRows) => {
        if (!cancelled) setPesAssemblyDestinations(nextRows);
      })
      .catch(() => {
        if (!cancelled) setPesAssemblyDestinations([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const load = async () => {
      if (cancelled) return;
      await loadPesItems(user, { silent: true });
    };

    load();
    timerId = window.setInterval(load, PES_DASHBOARD_POLL_MS);

    return () => {
      cancelled = true;
      if (timerId) window.clearInterval(timerId);
    };
  }, [loadPesItems, user]);

  const pesCountMaps = useMemo(
    () => buildPesDashboardCountMaps(pesItems, pesAssemblyDestinations, filialRows),
    [filialRows, pesAssemblyDestinations, pesItems]
  );

  const dataSource = useMemo(() => {
    let branchRows;
    if (groupBy === "okrug") {
      branchRows = buildOperationalOkrugRows(
        rows,
        filialRows,
        filialName,
        poName,
        poSlug,
        pesCountMaps,
        poOkrugLinkRows
      );
      return [...branchRows, buildOperationalOkrugSummary(branchRows)];
    } else if (groupBy === "po") {
      branchRows = buildOperationalPoRows(
        rows,
        filialRows,
        filialName,
        pesCountMaps,
        poOkrugLinkRows
      );
    } else {
      branchRows = buildOperationalBranchRows(rows, filialRows, pesCountMaps);
    }
    return [...branchRows, buildOperationalBranchSummary(branchRows)];
  }, [filialName, filialRows, groupBy, pesCountMaps, poName, poOkrugLinkRows, poSlug, rows]);

  const getHoverHandlers = (record) =>
    typeof onBranchHover === "function" && record?.key !== "summary"
      ? {
          onMouseEnter: () => onBranchHover(record.branch),
          onMouseLeave: () => onBranchHover(""),
          onFocus: () => onBranchHover(record.branch),
          onBlur: () => onBranchHover(""),
        }
      : {};

  const columns = useMemo(
    () =>
      OPERATIONAL_BRANCH_COLUMNS.map((column) => ({
        ...column,
          width:
          groupBy === "po" || groupBy === "okrug"
            ? OPERATIONAL_PO_COLUMN_WIDTHS[column.dataIndex] || column.width
            : OPERATIONAL_FILIAL_COLUMN_WIDTHS[column.dataIndex] || column.width,
        title:
          groupBy === "po" && column.dataIndex === "branch"
            ? "Производственное отделение/ сетевой участок"
            : groupBy === "okrug" && column.dataIndex === "branch"
              ? "Производственное отделение/ сетевой участок"
            : column.title,
        align: "center",
        render: (value, record) => {
          const formattedValue = formatCellValue(value);
          const hoverHandlers = getHoverHandlers(record);

          if (groupBy === "filial" && column.dataIndex === "branch" && record.key !== "summary") {
            return renderBranchLink(record.branch, formattedValue, hoverHandlers, basePath);
          }

          if (groupBy === "po" && column.dataIndex === "branch" && record.key !== "summary") {
            return renderPoLink(filialName, record.branch, formattedValue, hoverHandlers, basePath);
          }

          return formattedValue;
        },
      })),
    [basePath, filialName, groupBy, onBranchHover]
  );

  const panelClassName = [
    "operational-dashboard__panel",
    "operational-dashboard__panel--districts",
    "operational-districts-panel",
    groupBy === "filial" ? "operational-districts-panel--filial" : "",
    groupBy === "po" || groupBy === "okrug" ? "operational-districts-panel--po" : "",
    groupBy === "okrug" ? "operational-districts-panel--okrug" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName}>
      <div className="operational-dashboard__panel-body">
        <div className="operational-districts-panel__mobile-list">
          {dataSource.map((record) => (
            <section
              key={record.key}
              {...getHoverHandlers(record)}
              className={
                record.key === "summary"
                  ? "operational-districts-panel__mobile-card operational-districts-panel__mobile-card--summary"
                  : "operational-districts-panel__mobile-card"
              }
            >
              <h3>
                {groupBy === "filial" && record.key !== "summary"
                  ? renderBranchLink(
                      record.branch,
                      record.branch,
                      typeof onBranchHover === "function"
                        ? {
                            onMouseEnter: () => onBranchHover(record.branch),
                            onMouseLeave: () => onBranchHover(""),
                            onFocus: () => onBranchHover(record.branch),
                            onBlur: () => onBranchHover(""),
                          }
                        : {},
                      basePath
                    )
                  : groupBy === "po" && record.key !== "summary"
                    ? renderPoLink(
                        filialName,
                        record.branch,
                        record.branch,
                        typeof onBranchHover === "function"
                          ? getHoverHandlers(record)
                          : {},
                        basePath
                      )
                    : record.branch}
              </h3>
              <div className="operational-districts-panel__mobile-metrics">
                {OPERATIONAL_BRANCH_COLUMNS.filter((column) => column.dataIndex !== "branch").map(
                  (column) => (
                    <div
                      key={column.dataIndex}
                      className="operational-districts-panel__mobile-metric"
                    >
                      <span>{column.title}</span>
                      <strong>{formatCellValue(record[column.dataIndex])}</strong>
                    </div>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
        <Table
          className="operational-districts-panel__table"
          columns={columns}
          dataSource={dataSource}
          loading={{
            spinning: isLoading && hasLoaded,
            indicator: <BrandSunLoader size={32} />,
          }}
          pagination={false}
          rowClassName={(record) =>
            record.key === "summary" ? "operational-districts-panel__row--summary" : ""
          }
          onRow={(record) => getHoverHandlers(record)}
          size="small"
          scroll={
            groupBy === "po" || groupBy === "filial" || groupBy === "okrug"
              ? undefined
              : { x: OPERATIONAL_BRANCH_TABLE_SCROLL_X }
          }
          tableLayout="fixed"
        />
      </div>
    </div>
  );
}
