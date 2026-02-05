import React, { useEffect } from "react";
import { Button, Flex } from "antd";
import { useNavigate } from "react-router-dom";
import useAuth from "../../stores/useAuth";
import { logAuditEvent } from "../../utils/auditLogger";

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
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "click_dashboard", entity: "button" }, user);
          navigate("/dashboard");
        }}
      >
        Дашборд
      </Button>
      {/* <Button onClick={() => navigate("/pes")}>Модуль ПЭС</Button> */}
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "click_reset_filters", entity: "button" }, user);
          onReset?.();
        }}
      >
        Сбросить фильтры
      </Button>
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "click_ai_analytics", entity: "button" }, user);
          onAiAnalytics?.();
        }}
      >
        AI-Аналитика
      </Button>
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "toggle_sound", entity: "button" }, user);
          onToggleSound?.();
        }}
      >
        {soundEnabled ? "🔔 Звук: Вкл" : "🔕 Звук: Выкл"}
      </Button>
      {showJournal && (
        <Button
          onClick={() => {
            logAuditEvent({ page: "/", action: "open_send_journal", entity: "button" }, user);
            onOpenJournal && onOpenJournal();
          }}
        >
          Журнал отправки
        </Button>
      )}
    </Flex>
  );
}
