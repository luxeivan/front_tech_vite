import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
  Checkbox,
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

function PesCard({ item, selected, onToggle }) {
  const meta = STATUS_META[item.effectiveStatus] || STATUS_META.ready;
  return (
    <Card
      size="small"
      title={
        <Flex justify="space-between" align="center">
          <Space size={8}>
            <Checkbox checked={selected} onChange={() => onToggle(item.id)} />
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
        <Text type="secondary">Телефон диспетчера: {item.dispatcherPhone || "—"}</Text>
      </Space>
    </Card>
  );
}

export default function PesModule() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
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

  const loadItems = async () => {
    try {
      setLoading(true);
      setError("");
      const base = getBackendBase();
      const { data } = await axios.get(`${base}/services/pes/module/items`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwt") || ""}` },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setSummary(data?.summary || null);
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
    } catch (e) {
      setDestinations({ assembly: [], tp: [] });
    }
  };

  useEffect(() => {
    loadItems();
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

  const destinationOptions = useMemo(() => {
    const source = destinationType === "tp" ? destinations.tp : destinations.assembly;
    return source.map((x) => ({ label: `${x.title} — ${x.address}`, value: x.id }));
  }, [destinations, destinationType]);

  const toggleSelected = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const runAction = async (action) => {
    if (!canManage) {
      message.warning("Только роль standart может менять статусы ПЭС");
      return;
    }
    if (!selected.length) {
      message.warning("Выберите хотя бы одну ПЭС");
      return;
    }

    if (["dispatch", "reroute"].includes(action)) {
      if (!destinationId) {
        message.warning("Выберите точку назначения");
        return;
      }
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

      await axios.post(`${base}/services/pes/module/command`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          "x-view-role": user?.view_role || "",
        },
      });

      message.success("Операция выполнена");
      setComment("");
      setSelected([]);
      setDestinationId(undefined);
      await loadItems();
    } catch (e) {
      message.error(e?.response?.data?.message || e?.message || "Ошибка операции");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Space>
          <Button onClick={() => navigate("/")}>К журналу ТН</Button>
          <Title level={3} style={{ margin: 0 }}>Модуль ПЭС</Title>
        </Space>
        <Space>
          <Tag color={canManage ? "green" : "blue"}>
            {canManage ? "Режим управления" : "Режим просмотра"}
          </Tag>
          <Button onClick={loadItems} loading={loading}>Обновить</Button>
        </Space>
      </Flex>

      {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}

      {summary && (
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col><Tag>Всего: {summary.total}</Tag></Col>
          <Col><Tag color="green">Готова: {summary.ready}</Tag></Col>
          <Col><Tag color="cyan">Команда: {summary.commandSent}</Tag></Col>
          <Col><Tag color="magenta">Задержка: {summary.delayed}</Tag></Col>
          <Col><Tag color="gold">В пути: {summary.enRoute}</Tag></Col>
          <Col><Tag color="red">В работе: {summary.connected}</Tag></Col>
          <Col><Tag>В ремонте: {summary.repair}</Tag></Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
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
          <Col xs={24} md={8}>
            <Select
              allowClear
              placeholder="ПО"
              options={poOptions}
              value={poFilter}
              onChange={setPoFilter}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              allowClear
              placeholder="Статус"
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Text strong>Команда на ПЭС ({mode === "multi" ? "множественный" : "одиночный"} выбор)</Text>
          <Row gutter={[8, 8]}>
            <Col xs={24} md={8}>
              <Select
                value={destinationType}
                onChange={setDestinationType}
                disabled={mode === "multi"}
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
                style={{ width: "100%" }}
              />
            </Col>
          </Row>
          <Input.TextArea
            rows={2}
            placeholder="Комментарий (для отмены/корректировки)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Space wrap>
            <Button type="primary" onClick={() => runAction("dispatch")} loading={sending}>
              Команда на выезд
            </Button>
            <Button onClick={() => runAction("reroute")} loading={sending}>Корректировка маршрута</Button>
            <Button onClick={() => runAction("cancel")} loading={sending}>Отмена выезда</Button>
            <Divider type="vertical" />
            <Button onClick={() => runAction("depart")} loading={sending}>Фактический выезд</Button>
            <Button onClick={() => runAction("connect")} loading={sending}>Подключена</Button>
            <Button onClick={() => runAction("ready")} loading={sending}>Вернуть в резерв</Button>
            <Button onClick={() => runAction("repair")} loading={sending}>В ремонт</Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[10, 10]}>
        {filteredItems.map((item) => (
          <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
            <PesCard item={item} selected={selected.includes(item.id)} onToggle={toggleSelected} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
