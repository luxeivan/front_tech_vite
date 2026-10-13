import { Flex, Switch, Tooltip, Typography, message } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import axios from "axios";
import useAuth from "../../../stores/useAuth";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";
import { logAuditEvent, buildAuditHeaders } from "../../../utils/auditLogger";

const SERVICES_URL = String(
  import.meta.env.VITE_URL_BACKEND_SERVICES || import.meta.env.VITE_URL_BACKEND || ""
)
  .trim()
  .replace(/\/$/, "");

export default function AutoSendSwitch() {
  const user = useAuth((s) => s.user);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Переключатель показываем только конкретному пользователю (пока в тестовом режиме)
  const isStasUser =
    String(user?.email || "").trim().toLowerCase() === "yanutst@yandex.ru";
  const canManage =
    isStasUser && hasFeatureAccess(user?.view_role, "autoSendSwitch");

  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    (async () => {
      try {
        const jwt = localStorage.getItem("jwt");
        const r = await axios.get(`${SERVICES_URL}/services/autosend`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
          timeout: 10000,
        });
        if (alive) setChecked(Boolean(r?.data?.enabled));
      } catch {
        // fail-safe: автоотправка считается выключенной
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [canManage]);

  const handleToggle = async (next) => {
    if (saving) return;
    const prev = checked;
    setChecked(next);
    setSaving(true);
    try {
      const jwt = localStorage.getItem("jwt");
      await axios.put(
        `${SERVICES_URL}/services/autosend`,
        { enabled: next },
        {
          headers: {
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
            ...buildAuditHeaders(user, "/"),
          },
          timeout: 10000,
        }
      );
      logAuditEvent(
        {
          action: "autosend_toggle",
          entity: "autosend",
          entity_id: "tn-avtootpravkas",
          details: { enabled: next },
        },
        user
      );
      message.success(
        next
          ? "Автоотправка включена: новые аварийные ТН будут уходить в ЕДДС автоматически"
          : "Автоотправка выключена: отправка в ЕДДС только вручную"
      );
    } catch (e) {
      setChecked(prev);
      message.error(
        "Не удалось изменить автоотправку: " +
          (e?.response?.data?.error || e?.message || "неизвестно")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <Tooltip title={checked ? "Автоотправка включена" : "Автоотправка выключена"}>
      <Flex align="center" gap={8} style={{ whiteSpace: "nowrap" }}>
        <Typography.Text strong type={checked ? "success" : "secondary"}>
          Автоотправка
        </Typography.Text>
        <Switch
          checked={checked}
          loading={loading || saving}
          onChange={handleToggle}
          checkedChildren={<CheckOutlined />}
          unCheckedChildren={<CloseOutlined />}
          aria-label="Автоотправка"
        />
      </Flex>
    </Tooltip>
  );
}
