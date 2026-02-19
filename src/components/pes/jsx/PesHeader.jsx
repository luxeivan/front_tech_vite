import React from "react";
import { Button, Flex, Space, Tag, Typography } from "antd";

const { Title } = Typography;

export default function PesHeader({
  canManage,
  loading,
  filteredSummary,
  onBack,
  onRefresh,
  onOpenHistory,
}) {
  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Space>
          <Button size="small" onClick={onBack}>К журналу ТН</Button>
          <Title level={3} style={{ margin: 0 }}>
            Модуль ПЭС
          </Title>
        </Space>
        <Space>
          <Tag color={canManage ? "green" : "blue"}>
            {canManage ? "Режим управления" : "Режим просмотра"}
          </Tag>
          <Button size="small" onClick={onOpenHistory}>История операций</Button>
          <Button size="small" onClick={onRefresh} loading={loading}>Обновить</Button>
        </Space>
      </Flex>

      <div style={{ marginBottom: 8 }}>
        <Space wrap size={[6, 6]}>
          <Tag>Всего: {filteredSummary.total}</Tag>
          <Tag color="green">Готова: {filteredSummary.ready}</Tag>
          <Tag color="blue">Команда: {filteredSummary.commandSent}</Tag>
          <Tag color="blue">Задержка: {filteredSummary.delay}</Tag>
          <Tag color="gold">В пути: {filteredSummary.enRoute}</Tag>
          <Tag color="red">В работе: {filteredSummary.connected}</Tag>
          <Tag>В ремонте: {filteredSummary.repair}</Tag>
        </Space>
      </div>
    </>
  );
}
