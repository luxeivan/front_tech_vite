import React from "react";
import { Typography } from "antd";
import { formatDateTime, getActionMeta, statusLabel } from "../js/pesModuleMeta";

const { Text } = Typography;

export function buildPesHistoryColumns() {
  return [
    {
      title: "Время",
      dataIndex: "eventTime",
      width: 180,
      render: (v) => formatDateTime(v),
    },
    {
      title: "Операция",
      dataIndex: "action",
      width: 180,
      render: (v) => getActionMeta(v).title,
    },
    {
      title: "ПЭС",
      key: "pes",
      width: 220,
      render: (_, row) => (
        <div>
          <div>
            <b>№{row?.pes?.number || "—"}</b> {row?.pes?.name || ""}
          </div>
          <Text type="secondary">{row?.pes?.branch || row?.branch || "—"}</Text>
        </div>
      ),
    },
    {
      title: "Статус",
      key: "status",
      width: 260,
      render: (_, row) => `${statusLabel(row?.statusFrom)} → ${statusLabel(row?.statusTo)}`,
    },
    {
      title: "Назначение",
      key: "destination",
      render: (_, row) => row?.destinationTitle || row?.destinationAddress || "—",
    },
    {
      title: "Комментарий",
      dataIndex: "comment",
      render: (v) => v || "—",
    },
  ];
}
