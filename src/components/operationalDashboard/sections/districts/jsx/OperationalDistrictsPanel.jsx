import React, { useEffect, useMemo, useState } from "react";
import { Table } from "antd";
import { Link } from "react-router-dom";

import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import { fetchTnFilialyRows } from "../../../../../utils/tnFilialyApi";
import { fetchTnOkrugaRelationRows } from "../../../../../utils/tnOkrugaApi";
import { fetchTnPoRows } from "../../../../../utils/tnPosApi";
import { getOperationalFilialPath } from "../../../../../utils/operationalFilialRoutes";
import { OPERATIONAL_BRANCH_COLUMNS } from "../js/operationalDistrictsPanel.config";
import {
  buildOperationalBranchRows,
  buildOperationalBranchSummary,
  buildOperationalPoRows,
} from "../js/operationalDistrictsPanel.utils";
import "../css/OperationalDistrictsPanel.css";

const formatCellValue = (value) =>
  typeof value === "number" ? new Intl.NumberFormat("ru-RU").format(value) : value;

const renderBranchLink = (branch, children) => {
  const path = getOperationalFilialPath(`${branch} филиал`);
  return path ? (
    <Link className="operational-districts-panel__branch-link" to={path}>
      {children}
    </Link>
  ) : (
    children
  );
};

const OPERATIONAL_BRANCH_TABLE_SCROLL_X = OPERATIONAL_BRANCH_COLUMNS.reduce(
  (sum, column) => sum + Number(column.width || 0),
  0
);

const OPERATIONAL_FILIAL_COLUMN_WIDTHS = {
  branch: 100,
  lep: 30,
  tpRp: 34,
  population: 44,
  mkd: 30,
  boilerCtp: 40,
  vzuVns: 38,
  kns: 30,
  medical: 50,
  schools: 46,
  brigades: 38,
  staff: 40,
  vehicles: 38,
  pes: 30,
  mainResource: 42,
  ovb: 30,
};

const OPERATIONAL_PO_COLUMN_WIDTHS = {
  branch: 112,
  lep: 32,
  tpRp: 36,
  population: 48,
  mkd: 32,
  boilerCtp: 44,
  vzuVns: 42,
  kns: 32,
  medical: 56,
  schools: 52,
  brigades: 42,
  staff: 42,
  vehicles: 42,
  pes: 32,
  mainResource: 46,
  ovb: 32,
};

export default function OperationalDistrictsPanel({
  className = "",
  filialName = "",
  groupBy = "filial",
}) {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const [filialRows, setFilialRows] = useState([]);
  const [poRows, setPoRows] = useState([]);
  const [okrugaRows, setOkrugaRows] = useState([]);

  useEffect(() => {
    if (groupBy !== "filial") return undefined;

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
  }, [groupBy]);

  useEffect(() => {
    if (groupBy !== "po") return undefined;

    let cancelled = false;

    Promise.allSettled([fetchTnPoRows(), fetchTnOkrugaRelationRows()]).then((results) => {
      if (cancelled) return;

      const [poResult, okrugaResult] = results;
      setPoRows(poResult.status === "fulfilled" ? poResult.value : []);
      setOkrugaRows(okrugaResult.status === "fulfilled" ? okrugaResult.value : []);
    });

    return () => {
      cancelled = true;
    };
  }, [groupBy]);

  const dataSource = useMemo(() => {
    const branchRows =
      groupBy === "po"
        ? buildOperationalPoRows(rows, poRows, filialName, okrugaRows)
        : buildOperationalBranchRows(rows, filialRows);
    return [...branchRows, buildOperationalBranchSummary(branchRows)];
  }, [filialName, filialRows, groupBy, okrugaRows, poRows, rows]);

  const columns = useMemo(
    () =>
      OPERATIONAL_BRANCH_COLUMNS.map((column) => ({
        ...column,
        width:
          groupBy === "po"
            ? OPERATIONAL_PO_COLUMN_WIDTHS[column.dataIndex] || column.width
            : OPERATIONAL_FILIAL_COLUMN_WIDTHS[column.dataIndex] || column.width,
        title:
          groupBy === "po" && column.dataIndex === "branch"
            ? "Производственное отделение/ сетевой участок"
            : column.title,
        align: "center",
        render: (value, record) => {
          const formattedValue = formatCellValue(value);
          if (groupBy === "filial" && column.dataIndex === "branch" && record.key !== "summary") {
            return renderBranchLink(record.branch, formattedValue);
          }

          return formattedValue;
        },
      })),
    [groupBy]
  );

  const panelClassName = [
    "operational-dashboard__panel",
    "operational-dashboard__panel--districts",
    "operational-districts-panel",
    groupBy === "filial" ? "operational-districts-panel--filial" : "",
    groupBy === "po" ? "operational-districts-panel--po" : "",
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
              className={
                record.key === "summary"
                  ? "operational-districts-panel__mobile-card operational-districts-panel__mobile-card--summary"
                  : "operational-districts-panel__mobile-card"
              }
            >
              <h3>
                {groupBy === "filial" && record.key !== "summary"
                  ? renderBranchLink(record.branch, record.branch)
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
          loading={isLoading && hasLoaded}
          pagination={false}
          rowClassName={(record) =>
            record.key === "summary" ? "operational-districts-panel__row--summary" : ""
          }
          size="small"
          scroll={groupBy === "po" || groupBy === "filial" ? undefined : { x: OPERATIONAL_BRANCH_TABLE_SCROLL_X }}
          tableLayout="fixed"
        />
      </div>
    </div>
  );
}
