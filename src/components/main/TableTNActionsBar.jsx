import React from "react";
import { Button, Flex } from "antd";
import { useNavigate } from "react-router-dom";

/**
 * Панель действий над таблицей ТН.
 * Все обработчики пробрасываются сверху — компонент «тупой» и переиспользуемый.
 */
export default function TableTNActionsBar({
  onDashboard, // () => void
  onReset, // () => void
  onAiAnalytics, // () => void
  onToggleSound, // () => void
  soundEnabled = false, // boolean — состояние звука (контролируется родителем)
  style,
}) {
  const navigate = useNavigate();

  return (
    <Flex
      justify="center"
      gap={8}
      style={{ marginBottom: 12, flexWrap: "wrap", ...style }}
    >
      <Button onClick={() => navigate('/dashboard')}>Дашборд</Button>
      <Button onClick={onReset}>Сбросить фильтры</Button>
      <Button onClick={onAiAnalytics}>AI-Аналитика</Button>
      <Button onClick={onToggleSound}>
        {soundEnabled ? "🔔 Звук: Вкл" : "🔕 Звук: Выкл"}
      </Button>
    </Flex>
  );
}
