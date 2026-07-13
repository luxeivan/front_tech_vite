import React, { useMemo } from "react";
import { Table } from "antd";

import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import { OPERATIONAL_BRANCH_COLUMNS } from "../js/operationalDistrictsPanel.config";
import {
  buildOperationalBranchRows,
  buildOperationalBranchSummary,
} from "../js/operationalDistrictsPanel.utils";
import "../css/OperationalDistrictsPanel.css";

const formatCellValue = (value) =>
  typeof value === "number" ? new Intl.NumberFormat("ru-RU").format(value) : value;

export default function OperationalDistrictsPanel() {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);

  const dataSource = useMemo(() => {
    const branchRows = buildOperationalBranchRows(rows);
    return [...branchRows, buildOperationalBranchSummary(branchRows)];
  }, [rows]);

  const columns = useMemo(
    () =>
      OPERATIONAL_BRANCH_COLUMNS.map((column) => ({
        ...column,
        align: column.dataIndex === "branch" ? "left" : "center",
        render: (value) => formatCellValue(value),
      })),
    []
  );

  return (
    <div className="operational-dashboard__panel operational-dashboard__panel--districts operational-districts-panel">
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
              <h3>{record.branch}</h3>
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
          tableLayout="fixed"
        />
      </div>
    </div>
  );
}
