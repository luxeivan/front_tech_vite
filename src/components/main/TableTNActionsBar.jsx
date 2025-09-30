import React from "react";
import { Button, Flex } from "antd";
import { useNavigate } from "react-router-dom";

export default function TableTNActionsBar({
  onDashboard,
  onReset,
  onAiAnalytics,
  onToggleSound,
  soundEnabled = false,
  style,
}) {
  const navigate = useNavigate();

  return (
    <Flex
      justify="center"
      gap={8}
      style={{ marginBottom: 12, flexWrap: "wrap", ...style }}
    >
      <Button onClick={() => navigate("/dashboard")}>Дашборд</Button>
      <Button onClick={onReset}>Сбросить фильтры</Button>
      {/* <Button onClick={onAiAnalytics}>AI-Аналитика</Button>
      <Button onClick={onToggleSound}>
        {soundEnabled ? "🔔 Звук: Вкл" : "🔕 Звук: Выкл"}
      </Button> */}
    </Flex>
  );
}
