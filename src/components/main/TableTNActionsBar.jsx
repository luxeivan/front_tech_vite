import React, { useEffect } from "react";
import { Button, Flex } from "antd";
import { useNavigate } from "react-router-dom";
import useAuth from "../../stores/useAuth";
import { logAuditEvent } from "../../utils/auditLogger";

export default function TableTNActionsBar({
  style,
}) {
  const navigate = useNavigate();
  const { user, getUserMe } = useAuth();

  useEffect(() => {
    if (!user) {
      getUserMe?.();
    }
  }, [user, getUserMe]);

  return (
    <Flex
      justify="center"
      align="center"
      gap={8}
      wrap
      style={{ marginBottom: 12, ...style }}
    >
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "click_dashboard", entity: "button" }, user);
          navigate("/dashboard");
        }}
      >
        Дашборд
      </Button>
      <Button
        onClick={() => {
          logAuditEvent({ page: "/", action: "click_pes_module", entity: "button" }, user);
          navigate("/pes");
        }}
      >
        Модуль ПЭС
      </Button>
    </Flex>
  );
}
