import React, { useMemo } from "react";
import { Button, Drawer, Table } from "antd";
import { buildPesHistoryColumns } from "./PesHistoryColumns";

export default function PesHistoryDrawer({
  open,
  onClose,
  historyLoading,
  historyItems,
  historyPage,
  historyPageSize,
  historyTotal,
  onRefresh,
  onPageChange,
}) {
  const historyColumns = useMemo(() => buildPesHistoryColumns(), []);

  return (
    <Drawer
      title="История операций ПЭС"
      width={1200}
      open={open}
      onClose={onClose}
      extra={
        <Button onClick={() => onRefresh()} loading={historyLoading}>
          Обновить
        </Button>
      }
    >
      <Table
        rowKey={(row) => row.id}
        columns={historyColumns}
        dataSource={historyItems}
        loading={historyLoading}
        size="small"
        scroll={{ x: 1100 }}
        pagination={{
          current: historyPage,
          pageSize: historyPageSize,
          total: historyTotal,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          onChange: (nextPage, nextPageSize) => onPageChange(nextPage, nextPageSize),
        }}
      />
    </Drawer>
  );
}
