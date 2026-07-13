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
        <Table
          className="operational-districts-panel__table"
          columns={columns}
          dataSource={dataSource}
          loading={isLoading}
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
