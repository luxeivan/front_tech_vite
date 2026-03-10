import React from "react";
import { Button, Flex, Space, Tag, Typography } from "antd";

const { Text } = Typography;

export default function PesHeader({
  canManage,
  loading,
  filteredSummary,
  onRefresh,
  onOpenHistory,
}) {
  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
        <Space wrap size={[6, 6]}>
          <Tag color={canManage ? "green" : "blue"}>
            {canManage ? "Режим управления" : "Режим просмотра"}
          </Tag>
          <Tag>Всего: {filteredSummary.total}</Tag>
          <Tag color="green">Готова: {filteredSummary.ready}</Tag>
          <Tag color="blue">Команда: {filteredSummary.commandSent}</Tag>
          <Tag color="blue">Задержка: {filteredSummary.delay}</Tag>
          <Tag color="gold">В пути: {filteredSummary.enRoute}</Tag>
          <Tag color="red">В работе: {filteredSummary.connected}</Tag>
          <Tag>В ремонте: {filteredSummary.repair}</Tag>
        </Space>
        <Space size={8}>
          <Button size="small" onClick={onOpenHistory}>История операций</Button>
          <Button size="small" onClick={onRefresh} loading={loading}>Обновить</Button>
        </Space>
      </Flex>
      {/* <Text type="secondary" style={{ fontSize: 12 }}>
        Панель управления ПЭС
      </Text> */}
    </>
  );
}
