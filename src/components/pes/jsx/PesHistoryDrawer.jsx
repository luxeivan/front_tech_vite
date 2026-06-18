import React, { useMemo } from "react";
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Flex,
  Select,
  Space,
  Statistic,
  Table,
} from "antd";
import { buildPesHistoryColumns } from "./PesHistoryColumns";
import { getActionMeta, statusLabel } from "../js/pesModuleMeta";

const { RangePicker } = DatePicker;

function formatDuration(ms) {
  const totalMinutes = Math.floor(Number(ms || 0) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} д`);
  if (hours || days) parts.push(`${hours} ч`);
  parts.push(`${minutes} мин`);
  return parts.join(" ");
}

export default function PesHistoryDrawer({
  open,
  onClose,
  historyLoading,
  historyItems,
  historyPage,
  historyPageSize,
  historyTotal,
  historyMetrics,
  historyFilterOptions,
  historyActionFilter,
  onHistoryActionFilterChange,
  historyStatusFilter,
  onHistoryStatusFilterChange,
  historyPesIds,
  onHistoryPesIdsChange,
  historyDateRange,
  onHistoryDateRangeChange,
  onRefresh,
  onPageChange,
}) {
  const historyColumns = useMemo(() => buildPesHistoryColumns(), []);
  const metrics = historyMetrics || {};

  const actionOptions = useMemo(
    () => [
      { label: "Все события", value: "__all__" },
      ...(historyFilterOptions?.actions || []).map((action) => ({
        label: getActionMeta(action).title,
        value: action,
      })),
    ],
    [historyFilterOptions]
  );

  const statusOptions = useMemo(
    () => [
      { label: "Все статусы", value: "__all__" },
      ...(historyFilterOptions?.statuses || []).map((status) => ({
        label: statusLabel(status),
        value: status,
      })),
    ],
    [historyFilterOptions]
  );

  const pesOptions = useMemo(
    () =>
      (historyFilterOptions?.pes || []).map((item) => ({
        label: item.label || `№${item.number || item.value}`,
        value: item.value,
      })),
    [historyFilterOptions]
  );

  return (
    <Drawer
      title="История операций ПЭС"
      width="88vw"
      open={open}
      onClose={onClose}
      extra={
        <Button onClick={() => onRefresh()} loading={historyLoading}>
          Обновить
        </Button>
      }
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Card size="small">
          <Flex gap={12} wrap align="center">
            <RangePicker
              showTime
              allowClear
              value={historyDateRange}
              onChange={(value) => onHistoryDateRangeChange(value || [null, null])}
              placeholder={["Начало периода", "Конец периода"]}
              style={{ minWidth: 360 }}
            />
            <Select
              value={historyActionFilter}
              options={actionOptions}
              onChange={onHistoryActionFilterChange}
              style={{ minWidth: 220 }}
            />
            <Select
              value={historyStatusFilter}
              options={statusOptions}
              onChange={onHistoryStatusFilterChange}
              style={{ minWidth: 240 }}
            />
            <Select
              mode="multiple"
              allowClear
              showSearch
              maxTagCount="responsive"
              value={historyPesIds}
              options={pesOptions}
              placeholder="ПЭС"
              optionFilterProp="label"
              onChange={onHistoryPesIdsChange}
              style={{ minWidth: 280, flex: "1 1 280px" }}
            />
            <Button onClick={() => onRefresh({ nextPage: 1 })} loading={historyLoading}>
              Применить
            </Button>
          </Flex>
        </Card>

        <Flex gap={12} wrap>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="Событий" value={metrics.eventsCount || historyTotal || 0} />
          </Card>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="Команд на выезд" value={metrics.departuresCount || 0} />
          </Card>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="Фактических выездов" value={metrics.actualDeparturesCount || 0} />
          </Card>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="В пути" value={formatDuration(metrics.travelMs)} />
          </Card>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="В работе" value={formatDuration(metrics.workMs)} />
          </Card>
          <Card size="small" style={{ minWidth: 180, flex: "1 1 180px" }}>
            <Statistic title="В ремонте" value={formatDuration(metrics.repairMs)} />
          </Card>
        </Flex>

        <Table
          rowKey={(row) => row.id}
          columns={historyColumns}
          dataSource={historyItems}
          loading={historyLoading}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{
            current: historyPage,
            pageSize: historyPageSize,
            total: historyTotal,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} из ${total}`,
            pageSizeOptions: [20, 50, 100, 200],
            onChange: (nextPage, nextPageSize) => onPageChange(nextPage, nextPageSize),
          }}
        />
      </Space>
    </Drawer>
  );
}
