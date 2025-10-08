import React, { useEffect } from "react";
import { Button, Flex } from "antd";
import { useNavigate } from "react-router-dom";
import useAuth from "../../stores/useAuth";

export default function TableTNActionsBar({
  onReset,
  onAiAnalytics,
  style,
  viewRole,
  onOpenJournal,
  onToggleSound,
  soundEnabled,
}) {
  const navigate = useNavigate();
  const { user, getUserMe } = useAuth();

  useEffect(() => {
    if (!user) {
      getUserMe?.();
    }
  }, [user, getUserMe]);

  const effectiveRole = viewRole || user?.view_role || null;
  const showJournal = effectiveRole === "standart";

  return (
    <Flex
      justify="center"
      gap={8}
      style={{ marginBottom: 12, flexWrap: "wrap", ...style }}
    >
      <Button onClick={() => navigate("/dashboard")}>Дашборд</Button>
      <Button onClick={onReset}>Сбросить фильтры</Button>
      <Button onClick={onAiAnalytics}>AI-Аналитика</Button>
      <Button onClick={onToggleSound}>
        {soundEnabled ? "🔔 Звук: Вкл" : "🔕 Звук: Выкл"}
      </Button>
      {showJournal && (
        <Button onClick={() => onOpenJournal && onOpenJournal()}>
          Журнал отправки
        </Button>
      )}
    </Flex>
  );
}
