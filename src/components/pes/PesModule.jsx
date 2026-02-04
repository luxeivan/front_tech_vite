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
            <Checkbox
              checked={selected}
              disabled={!selectable}
              onChange={() => onToggle(item.id)}
            />
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

  const [branchFilter, setBranchFilter] = useState(undefined);
  const [poFilter, setPoFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

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
        headers: { Authorization: `Bearer ${localStorage.getItem("jwt") || ""}` },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Ошибка загрузки ПЭС");
    } finally {
      setLoading(false);
    }
  };

  const loadDestinations = async (nextMode) => {
    try {
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/destinations`, {
        params: { mode: nextMode },
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

  useEffect(() => {
    loadDestinations(mode);
  }, [mode]);

  const branchOptions = useMemo(
    () => Array.from(new Set(items.map((x) => x.branch).filter(Boolean))).map((x) => ({ label: x, value: x })),
    [items]
  );

  const poOptions = useMemo(() => {
    const subset = branchFilter ? items.filter((x) => x.branch === branchFilter) : items;
    return Array.from(new Set(subset.map((x) => x.po).filter(Boolean))).map((x) => ({ label: x, value: x }));
  }, [items, branchFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((x) => {
      if (branchFilter && x.branch !== branchFilter) return false;
      if (poFilter && x.po !== poFilter) return false;
      if (statusFilter && x.effectiveStatus !== statusFilter) return false;
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

  const toggleSelected = (id) => {
    if (!canManage) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setBranchFilter(undefined);
    setPoFilter(undefined);
    setStatusFilter(undefined);
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

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={7}>
            <Select
              allowClear
              placeholder="Филиал"
              options={branchOptions}
              value={branchFilter}
              onChange={(v) => {
                setBranchFilter(v);
                setPoFilter(undefined);
              }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              allowClear
              placeholder="ПО"
              options={poOptions}
              value={poFilter}
              onChange={setPoFilter}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              allowClear
              placeholder="Статус"
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_META).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={3}>
            <Button block onClick={resetFilters}>Сбросить</Button>
          </Col>
        </Row>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Text strong>
            Команда на ПЭС ({mode === "multi" ? "множественный" : "одиночный"} выбор), выбрано: {selected.length}
          </Text>
          <Row gutter={[8, 8]}>
            <Col xs={24} md={8}>
              <Select
                value={destinationType}
                onChange={setDestinationType}
                disabled={!canManage || mode === "multi" || sending}
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
                disabled={!canManage || sending}
                style={{ width: "100%" }}
              />
            </Col>
          </Row>
          <Input.TextArea
            rows={2}
            placeholder="Комментарий (для отмены/корректировки)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={!canManage || sending}
          />
          <Space wrap>
            <Button type="primary" onClick={() => runAction("dispatch")} loading={sending} disabled={!canManage}>
              Команда на выезд
            </Button>
            <Button onClick={() => runAction("reroute")} loading={sending} disabled={!canManage}>
              Корректировка маршрута
            </Button>
            <Button onClick={() => runAction("cancel")} loading={sending} disabled={!canManage}>
              Отмена выезда
            </Button>
            <Divider type="vertical" />
            <Button onClick={() => runAction("depart")} loading={sending} disabled={!canManage}>
              Фактический выезд
            </Button>
            <Button onClick={() => runAction("connect")} loading={sending} disabled={!canManage}>
              Подключена
            </Button>
            <Button onClick={() => runAction("ready")} loading={sending} disabled={!canManage}>
              Вернуть в резерв
            </Button>
            <Button onClick={() => runAction("repair")} loading={sending} disabled={!canManage}>
              В ремонт
            </Button>
          </Space>
        </Space>
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
