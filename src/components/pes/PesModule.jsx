import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Flex,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  notification,
} from "antd";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import useAuth from "../../stores/useAuth";
import { buildAuditHeaders, logAuditEvent } from "../../utils/auditLogger";

const { Title, Text } = Typography;

const STATUS_META = {
  ready: { label: "Готова к выезду", color: "green" },
  command_sent: { label: "Дана команда", color: "cyan" },
  delayed: { label: "Задержка выезда", color: "magenta" },
  en_route: { label: "В пути", color: "gold" },
  connected: { label: "Подключена", color: "red" },
  repair: { label: "В ремонте", color: "default" },
};

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

function PesCard({ item, selected, onToggle, selectable }) {
  const meta = STATUS_META[item.effectiveStatus] || STATUS_META.ready;
  return (
    <Card
      size="small"
      title={
        <Flex justify="space-between" align="center">
          <Space size={8}>
            {selectable ? (
              <Checkbox checked={selected} onChange={() => onToggle(item.id)} />
            ) : null}
            <Text strong>ПЭС №{item.number}</Text>
          </Space>
          <Tag color={meta.color}>{meta.label}</Tag>
        </Flex>
      }
      bodyStyle={{ padding: 12 }}
      style={{ borderRadius: 12, minHeight: 186 }}
    >
      <Space direction="vertical" size={2} style={{ width: "100%" }}>
        <Text>{item.name}</Text>
        <Text type="secondary">{item.branch}</Text>
        <Text type="secondary">{item.po}</Text>
        <Text>Мощность: {item.powerKw} кВт</Text>
        <Text type="secondary">
          Телефон диспетчера: {item.dispatcherPhone || "—"}
        </Text>
      </Space>
    </Card>
  );
}

function getActionMeta(action) {
  if (action === "dispatch") return { title: "Команда на выезд", description: "Команда успешно отправлена по выбранным ПЭС." };
  if (action === "reroute") return { title: "Корректировка маршрута", description: "Точка назначения обновлена." };
  if (action === "cancel") return { title: "Отмена выезда", description: "Команда на выезд отменена, ПЭС возвращены в резерв." };
  if (action === "depart") return { title: "Фактический выезд", description: "ПЭС переведены в статус 'В пути'." };
  if (action === "connect") return { title: "Подключена", description: "ПЭС переведены в статус 'Подключена'." };
  if (action === "ready") return { title: "Возврат в резерв", description: "ПЭС переведены в статус 'Готова к выезду'." };
  if (action === "repair") return { title: "Статус ремонта", description: "ПЭС переведены в статус 'В ремонте'." };
  return { title: "Операция", description: "Операция выполнена." };
}

function calcSummary(items) {
  const s = {
    total: items.length,
    ready: 0,
    commandSent: 0,
    delayed: 0,
    enRoute: 0,
    connected: 0,
    repair: 0,
  };

  items.forEach((x) => {
    if (x.effectiveStatus === "ready") s.ready += 1;
    else if (x.effectiveStatus === "command_sent") s.commandSent += 1;
    else if (x.effectiveStatus === "delayed") s.delayed += 1;
    else if (x.effectiveStatus === "en_route") s.enRoute += 1;
    else if (x.effectiveStatus === "connected") s.connected += 1;
    else if (x.effectiveStatus === "repair") s.repair += 1;
  });

  return s;
}

export default function PesModule() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [config, setConfig] = useState(null);
  const [selected, setSelected] = useState([]);

  const [branchFilter, setBranchFilter] = useState("__all__");
  const [poFilter, setPoFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

  const [destinations, setDestinations] = useState({ assembly: [], tp: [] });
  const [destinationType, setDestinationType] = useState("assembly");
  const [destinationId, setDestinationId] = useState(undefined);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const canManage = user?.view_role === "standart";
  const mode = selected.length > 1 ? "multi" : "single";

  const loadConfig = async () => {
    try {
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/config`);
      setConfig(data || null);
    } catch {
      setConfig(null);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError("");
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/items`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          ...buildAuditHeaders(user, "/pes"),
        },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Ошибка загрузки ПЭС");
    } finally {
      setLoading(false);
    }
  };

  const loadDestinations = async (nextMode, branch) => {
    try {
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/destinations`, {
        params: { mode: nextMode, branch: branch || undefined },
      });
      const next = {
        assembly: Array.isArray(data?.assembly) ? data.assembly : [],
        tp: Array.isArray(data?.tp) ? data.tp : [],
      };
      setDestinations(next);
      if (nextMode === "multi") {
        setDestinationType("assembly");
      }
      setDestinationId(undefined);
    } catch {
      setDestinations({ assembly: [], tp: [] });
    }
  };

  useEffect(() => {
    loadItems();
    loadConfig();
  }, []);

  const destinationBranch = useMemo(() => {
    if (selected.length === 1) {
      const item = items.find((x) => x.id === selected[0]);
      if (item?.branch) return item.branch;
    }
    if (branchFilter !== "__all__") return branchFilter;
    return "";
  }, [selected, items, branchFilter]);

  useEffect(() => {
    loadDestinations(mode, destinationBranch);
  }, [mode, destinationBranch]);

  const branchOptions = useMemo(
    () => [
      { label: "Все филиалы", value: "__all__" },
      ...Array.from(new Set(items.map((x) => x.branch).filter(Boolean))).map((x) => ({ label: x, value: x })),
    ],
    [items]
  );

  const poOptions = useMemo(() => {
    const subset =
      branchFilter && branchFilter !== "__all__"
        ? items.filter((x) => x.branch === branchFilter)
        : items;
    return [
      { label: "Все ПО", value: "__all__" },
      ...Array.from(new Set(subset.map((x) => x.po).filter(Boolean))).map((x) => ({ label: x, value: x })),
    ];
  }, [items, branchFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((x) => {
      if (branchFilter !== "__all__" && x.branch !== branchFilter) return false;
      if (poFilter !== "__all__" && x.po !== poFilter) return false;
      if (statusFilter !== "__all__" && x.effectiveStatus !== statusFilter) return false;
      return true;
    });
  }, [items, branchFilter, poFilter, statusFilter]);

  const filteredSummary = useMemo(() => calcSummary(filteredItems), [filteredItems]);

  useEffect(() => {
    const allowed = new Set(filteredItems.map((x) => x.id));
    setSelected((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredItems]);

  const destinationOptions = useMemo(() => {
    const source = destinationType === "tp" ? destinations.tp : destinations.assembly;
    return source.map((x) => ({ label: `${x.title} — ${x.address}`, value: x.id }));
  }, [destinations, destinationType]);

  const selectedItems = useMemo(
    () => items.filter((x) => selected.includes(x.id)),
    [items, selected]
  );

  const isAllowedTransition = (action, item) => {
    const st = item?.effectiveStatus;
    if (action === "dispatch") return st === "ready";
    if (action === "reroute") return ["command_sent", "delayed", "en_route"].includes(st);
    if (action === "cancel") return ["command_sent", "delayed", "en_route"].includes(st);
    if (action === "depart") return ["command_sent", "delayed"].includes(st);
    if (action === "connect") return st === "en_route";
    if (action === "ready") return ["connected", "repair"].includes(st);
    if (action === "repair") return st !== "repair";
    return true;
  };

  const actionState = (action) => {
    if (!canManage) return { disabled: true, reason: "Режим просмотра" };
    if (!selectedItems.length) return { disabled: true, reason: "Сначала отметьте хотя бы одну ПЭС" };
    if (["dispatch", "reroute"].includes(action) && !destinationId) {
      return { disabled: true, reason: "Выберите точку назначения" };
    }
    const invalid = selectedItems.find((x) => !isAllowedTransition(action, x));
    if (invalid) {
      return {
        disabled: true,
        reason: `ПЭС №${invalid.number}: недопустимый статус для этой операции`,
      };
    }
    return { disabled: false, reason: "" };
  };

  const toggleSelected = (id) => {
    if (!canManage) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setBranchFilter("__all__");
    setPoFilter("__all__");
    setStatusFilter("__all__");
  };

  const runAction = async (action) => {
    if (!canManage) {
      notification.warning({
        message: "Режим просмотра",
        description: "У роли supergeneral операции управления ПЭС недоступны.",
        placement: "topRight",
      });
      return;
    }
    if (!selected.length) {
      notification.warning({
        message: "Не выбраны ПЭС",
        description: "Отметьте хотя бы одну ПЭС перед выполнением операции.",
        placement: "topRight",
      });
      return;
    }

    if (["dispatch", "reroute"].includes(action) && !destinationId) {
      notification.warning({
        message: "Не выбрана точка назначения",
        description: "Для этой операции нужно выбрать точку назначения.",
        placement: "topRight",
      });
      return;
    }

    try {
      setSending(true);
      const base = getBackendBase();
      const payload = {
        action,
        pesIds: selected,
        destinationType,
        destinationId,
        comment,
      };
      if (action === "depart") {
        payload.actualDepartureAt = new Date().toISOString();
      }

      const { data } = await axios.post(
        `${base}/services/pes/module/command`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
            "x-view-role": user?.view_role || "",
            ...buildAuditHeaders(user, "/pes"),
          },
        }
      );

      const meta = getActionMeta(action);
      if (data?.telegram?.skipped) {
        notification.warning({
          message: `${meta.title}: выполнено частично`,
          description: `Операция применена, но Telegram пропущен: ${data?.telegram?.reason || "не настроен"}.`,
          placement: "topRight",
          duration: 5,
        });
      } else {
        notification.success({
          message: meta.title,
          description: meta.description,
          placement: "topRight",
          duration: 4,
        });
      }
      logAuditEvent(
        {
          page: "/pes",
          action: `pes_${action}`,
          entity: "pes",
          entity_id: selected.join(","),
          details: {
            destinationType,
            destinationId,
          },
        },
        user
      );

      setComment("");
      setSelected([]);
      setDestinationId(undefined);
      await loadItems();
    } catch (e) {
      notification.error({
        message: "Ошибка операции",
        description: e?.response?.data?.message || e?.message || "Не удалось выполнить операцию по ПЭС.",
        placement: "topRight",
        duration: 6,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Space>
          <Button onClick={() => navigate("/")}>К журналу ТН</Button>
          <Title level={3} style={{ margin: 0 }}>
            Модуль ПЭС
          </Title>
        </Space>
        <Space>
          <Tag color={canManage ? "green" : "blue"}>
            {canManage ? "Режим управления" : "Режим просмотра"}
          </Tag>
          <Button onClick={loadItems} loading={loading}>
            Обновить
          </Button>
        </Space>
      </Flex>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={error}
        />
      )}
      {config && !config.telegramConfigured && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Telegram-уведомления пока не настроены (работаем в режиме подготовки)."
        />
      )}
      {!canManage && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Роль supergeneral: только просмотр (управление ПЭС заблокировано)."
        />
      )}

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col>
          <Tag>Всего: {filteredSummary.total}</Tag>
        </Col>
        <Col>
          <Tag color="green">Готова: {filteredSummary.ready}</Tag>
        </Col>
        <Col>
          <Tag color="cyan">Команда: {filteredSummary.commandSent}</Tag>
        </Col>
        <Col>
          <Tag color="magenta">Задержка: {filteredSummary.delayed}</Tag>
        </Col>
        <Col>
          <Tag color="gold">В пути: {filteredSummary.enRoute}</Tag>
        </Col>
        <Col>
          <Tag color="red">В работе: {filteredSummary.connected}</Tag>
        </Col>
        <Col>
          <Tag>В ремонте: {filteredSummary.repair}</Tag>
        </Col>
      </Row>

      {canManage ? (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Text strong>
              Команда на ПЭС ({mode === "multi" ? "множественный" : "одиночный"} выбор), выбрано: {selected.length}
            </Text>
            <Alert
              type="info"
              showIcon
              message="Как работать: 1) отметьте ПЭС галочкой на карточке, 2) выберите точку назначения, 3) нажмите нужную кнопку операции. Комментарий отправляется вместе с командой."
            />
            <Row gutter={[8, 8]}>
              <Col xs={24} md={8}>
                <Select
                  value={destinationType}
                  onChange={setDestinationType}
                  disabled={mode === "multi" || sending}
                  options={[
                    { value: "assembly", label: "Точка сбора ПЭС" },
                    { value: "tp", label: "ТП (только одиночный выбор)" },
                  ]}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col xs={24} md={16}>
                <Select
                  showSearch
                  value={destinationId}
                  onChange={setDestinationId}
                  options={destinationOptions}
                  placeholder="Точка назначения"
                  optionFilterProp="label"
                  disabled={sending}
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>
            <Input.TextArea
              rows={2}
              placeholder="Комментарий к операции (уйдет в уведомление Telegram)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={sending}
            />
            <Space wrap>
              <Button
                type="primary"
                onClick={() => runAction("dispatch")}
                loading={sending}
                disabled={actionState("dispatch").disabled || sending}
                title={actionState("dispatch").reason}
              >
                Команда на выезд
              </Button>
              <Button
                onClick={() => runAction("reroute")}
                loading={sending}
                disabled={actionState("reroute").disabled || sending}
                title={actionState("reroute").reason}
              >
                Корректировка маршрута
              </Button>
              <Button
                onClick={() => runAction("cancel")}
                loading={sending}
                disabled={actionState("cancel").disabled || sending}
                title={actionState("cancel").reason}
              >
                Отмена выезда
              </Button>
              <Divider type="vertical" />
              <Button
                onClick={() => runAction("depart")}
                loading={sending}
                disabled={actionState("depart").disabled || sending}
                title={actionState("depart").reason}
              >
                Фактический выезд
              </Button>
              <Button
                onClick={() => runAction("connect")}
                loading={sending}
                disabled={actionState("connect").disabled || sending}
                title={actionState("connect").reason}
              >
                Подключена
              </Button>
              <Button
                onClick={() => runAction("ready")}
                loading={sending}
                disabled={actionState("ready").disabled || sending}
                title={actionState("ready").reason}
              >
                Вернуть в резерв
              </Button>
              <Button
                onClick={() => runAction("repair")}
                loading={sending}
                disabled={actionState("repair").disabled || sending}
                title={actionState("repair").reason}
              >
                В ремонт
              </Button>
            </Space>
          </Space>
        </Card>
      ) : null}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={7}>
            <Select
              placeholder="Филиал"
              options={branchOptions}
              value={branchFilter}
              onChange={(v) => {
                setBranchFilter(v);
                setPoFilter("__all__");
              }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              placeholder="ПО"
              options={poOptions}
              value={poFilter}
              onChange={setPoFilter}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              placeholder="Статус"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Все статусы", value: "__all__" },
                ...Object.entries(STATUS_META).map(([value, meta]) => ({
                  value,
                  label: meta.label,
                })),
              ]}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={3}>
            <Button block onClick={resetFilters}>Сбросить</Button>
          </Col>
        </Row>
      </Card>

      {filteredItems.length === 0 ? (
        <Card>
          <Empty description="По текущим фильтрам ПЭС не найдены" />
        </Card>
      ) : (
        <Row gutter={[10, 10]}>
          {filteredItems.map((item) => (
            <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
              <PesCard
                item={item}
                selected={selected.includes(item.id)}
                onToggle={toggleSelected}
                selectable={canManage && !sending}
              />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
