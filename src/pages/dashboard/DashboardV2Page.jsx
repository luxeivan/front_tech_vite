import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Skeleton, Space, Spin, message } from "antd";
import {
  CheckSquareOutlined,
  DownloadOutlined,
  LinkOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import axios from "axios";

import MapPanel from "../../components/dashboard/jsx/MapPanel";
import Dinamica7Days from "../../components/dashboard/jsx/Dinamica";
import RegionSZO from "../../components/dashboard/jsx/RegionSZO";
import {
  extractFiasFromRow,
  FIAS_COLLECTION,
  fetchDashboardRows,
  tnNumber,
  URL,
} from "../../components/dashboard/js/dashboardPage.utils";
import {
  districtName,
  isDashboardBaseType,
  isOpenTN,
  pick,
  pickAny,
  recoveryDate,
  startDate,
  toNumber,
} from "../../components/dashboard/js/dashboardCommon";
import { engineeringDayKey } from "../../components/dashboard/js/engineeringDay";
import pesModuleLogic from "../../components/pes/js/pesModuleLogic";
import { formatDateTime, formatPowerKw, STATUS_META, statusLabel } from "../../components/pes/js/pesModuleMeta";
import PesCommandCard from "../../components/pes/jsx/PesCommandCard";
import PesFiltersCard from "../../components/pes/jsx/PesFiltersCard";
import PesHistoryDrawer from "../../components/pes/jsx/PesHistoryDrawer";
import PesTilesBoard from "../../components/pes/jsx/PesTilesBoard";
import "../../components/pes/css/PesModule.css";
import "./DashboardV2Page.css";

const STATUS_CHIPS = [
  { key: "total", label: "Всего", className: "dashboard-v2-chip--default", powerStatuses: null },
  { key: "ready", label: "Готова", className: "dashboard-v2-chip--ready", powerStatuses: ["ready"] },
  { key: "commandSent", label: "Команда", className: "dashboard-v2-chip--command", powerStatuses: ["command_sent"] },
  { key: "delay", label: "Задержка", className: "dashboard-v2-chip--delay", powerStatuses: ["delay"] },
  { key: "enRoute", label: "В пути", className: "dashboard-v2-chip--route", powerStatuses: ["en_route"] },
  { key: "connected", label: "В работе", className: "dashboard-v2-chip--work", powerStatuses: ["connected"] },
  { key: "repair", label: "В ремонте", className: "dashboard-v2-chip--default", powerStatuses: ["repair"] },
];

const DASHBOARD_V2_BRANCH_GROUPS = [
  {
    title: "Север и северо-восток",
    branches: ["Мытищинский", "Сергиево-Посадский", "Щёлковский"],
  },
  {
    title: "Восток и юго-восток",
    branches: ["Павлово-Посадский", "Орехово-Зуевский", "Раменский"],
  },
  {
    title: "Юг",
    branches: ["Домодедовский", "Коломенский"],
  },
  {
    title: "Запад",
    branches: ["Красногорский", "Одинцовский"],
  },
];

function sumPower(items, statuses = null) {
  const allowed = Array.isArray(statuses) ? new Set(statuses) : null;
  return (items || []).reduce((acc, item) => {
    if (allowed && !allowed.has(item?.effectiveStatus)) return acc;
    const value = Number(item?.powerKw);
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);
}

function buildPesExportRows(items) {
  return (items || []).map((item) => ({
    "Номер": item.number || "",
    "Мощность, кВт": formatPowerKw(item.powerKw),
    "Статус": statusLabel(item.effectiveStatus),
    "Филиал": item.branch || "",
    "ПО": item.po || "",
    "Место базирования": item.baseAddress || item.parkingAddress || item.locationAddress || "",
    "Место назначения": item.destination?.address || item.destination?.title || item.destination?.name || "",
    "Время команды": formatDateTime(item.commandSentAt),
    "Фактический выезд": formatDateTime(item.actualDepartureAt),
    "Подключение": formatDateTime(item.connectedAt),
    "Диспетчер": item.dispatcherPhone || "",
  }));
}

function exportPesToXlsx(items) {
  const rows = buildPesExportRows(items);
  if (!rows.length) {
    message.warning("Нет ПЭС для выгрузки по текущим фильтрам.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 24 },
    { wch: 22 },
    { wch: 24 },
    { wch: 32 },
    { wch: 36 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ПЭС");
  XLSX.writeFile(wb, `pes-export-${dayjs().format("YYYY-MM-DD-HH-mm")}.xlsx`);
}

function getPesDestinationDistrict(item) {
  const dest = item?.destination || {};
  return (
    dest.district ||
    dest.okrug ||
    dest.cityDistrict ||
    dest.municipality ||
    dest.gorodskoyOkrug ||
    dest.gorodskoiOkrug ||
    item?.destinationDistrict ||
    ""
  );
}

function DashboardV2TodayDuration({ rows7d = [] }) {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const todayKey = engineeringDayKey(now);
    const sameWorkday = (value) => (value ? engineeringDayKey(value) === todayKey : false);
    const nowTs = now.valueOf();
    const source = (Array.isArray(rows7d) ? rows7d : []).filter(isDashboardBaseType);

    const isDeletedRow = (row) => {
      const status = String(pick(row, "STATUS_NAME") ?? row?.STATUS_NAME ?? "").toLowerCase();
      return status.includes("удален") || status.includes("delete");
    };
    const isClosedRow = (row) => {
      if (isOpenTN(row) || isDeletedRow(row)) return false;
      const updatedAt = pick(row, "updatedAt") ?? row?.updatedAt ?? null;
      return sameWorkday(updatedAt) || sameWorkday(recoveryDate(row));
    };
    const durationHoursOf = (row) => {
      const startTs = dayjs(startDate(row)).valueOf();
      if (!Number.isFinite(startTs) || startTs <= 0) return null;
      const status = String(pick(row, "STATUS_NAME") ?? row?.STATUS_NAME ?? "").toLowerCase();
      const isFinal = ["запитана", "закрыта"].includes(status);
      let endTs = nowTs;
      if (isFinal) {
        const recoveryTs = dayjs(
          pickAny(row, ["factRestoreDateTime", "F81_070_RESTOR_SUPPLAYDATETIME", "recoveryFactDateTime"])
        ).valueOf();
        const updatedTs = dayjs(pick(row, "updatedAt") ?? row?.updatedAt ?? null).valueOf();
        endTs = Number.isFinite(recoveryTs) && recoveryTs > 0 ? recoveryTs : updatedTs;
      }
      if (!Number.isFinite(endTs) || endTs <= startTs) return null;
      return (endTs - startTs) / (60 * 60 * 1000);
    };

    const result = {
      green: 0,
      orange: 0,
      red: 0,
      open: 0,
      total: 0,
    };

    source
      .filter((row) => sameWorkday(startDate(row)) && !isDeletedRow(row))
      .forEach((row) => {
        result.total += 1;
        if (!isClosedRow(row)) {
          result.open += 1;
          return;
        }
        const hours = durationHoursOf(row);
        if (hours == null) return;
        if (hours > 4) result.red += 1;
        else if (hours > 2) result.orange += 1;
        else result.green += 1;
      });

    return result;
  }, [now, rows7d]);

  const total = stats.green + stats.orange + stats.red + stats.open;
  const deg = (value) => (total ? (value / total) * 360 : 0);
  const greenDeg = deg(stats.green);
  const orangeDeg = deg(stats.orange);
  const redDeg = deg(stats.red);
  const openDeg = deg(stats.open);
  const ring = total
    ? `conic-gradient(#8bd24b 0 ${greenDeg}deg, #ffc20d ${greenDeg}deg ${
        greenDeg + orangeDeg
      }deg, #ff1212 ${greenDeg + orangeDeg}deg ${
        greenDeg + orangeDeg + redDeg
      }deg, #bfbfbf ${greenDeg + orangeDeg + redDeg}deg ${
        greenDeg + orangeDeg + redDeg + openDeg
      }deg)`
    : "#f0f0f0";

  const legend = [
    { color: "#8bd24b", label: "Закрытые (до 2 ч.)", value: stats.green },
    { color: "#ffc20d", label: "Закрытые (2-4 ч.)", value: stats.orange },
    { color: "#ff1212", label: "Закрытые (более 4 ч.)", value: stats.red },
    { color: "#bfbfbf", label: "Открытые", value: stats.open },
  ];

  return (
    <Card className="dashboard-v2-card dashboard-v2-donut-card" size="small" title="ТН за сегодня">
      <div className="dashboard-v2-donut" style={{ "--dashboard-v2-ring": ring }}>
        <div className="dashboard-v2-donut__value">{total}</div>
      </div>
      <div className="dashboard-v2-donut__legend">
        {legend.map((item) => (
          <div key={item.label} className="dashboard-v2-donut__legend-row">
            <span style={{ background: item.color }} />
            <b>{item.label}</b>
            <em>{item.value}</em>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardV2Page() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [rows7d, setRows7d] = useState([]);
  const esRef = useRef(null);

  const pes = pesModuleLogic();

  const fiasCodes = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => extractFiasFromRow(row)).filter(Boolean))),
    [rows]
  );

  const fiasOwners = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const num = tnNumber(row);
      if (!num) return;
      extractFiasFromRow(row).forEach((code) => {
        if (!code) return;
        if (!map.has(code)) map.set(code, new Set());
        map.get(code).add(num);
      });
    });
    const obj = {};
    map.forEach((set, key) => {
      obj[key] = Array.from(set);
    });
    return obj;
  }, [rows]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      const data = await fetchDashboardRows({ axios, jwt });
      setRows(data.rows);
      setRows7d(data.rows7d);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!URL) return undefined;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(loadDashboardData, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(loadDashboardData, 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, []);

  const readyFilteredItems = useMemo(
    () => pes.filteredItems.filter((item) => item.effectiveStatus === "ready"),
    [pes.filteredItems]
  );
  const selectedSet = useMemo(() => new Set(pes.selected), [pes.selected]);
  const selectedDutyCount = useMemo(
    () => readyFilteredItems.filter((item) => selectedSet.has(item.id)).length,
    [readyFilteredItems, selectedSet]
  );
  const allDutySelected = readyFilteredItems.length > 0 && selectedDutyCount === readyFilteredItems.length;

  const handleSelectAllDuty = () => {
    if (!pes.canManage) return;
    const itemsToToggle = allDutySelected
      ? readyFilteredItems
      : readyFilteredItems.filter((item) => !selectedSet.has(item.id));
    itemsToToggle.forEach((item) => pes.toggleSelected(item.id));
    message.success(
      allDutySelected
        ? `Снят выбор дежурных ПЭС: ${readyFilteredItems.length}`
        : `Выбрано дежурных ПЭС: ${readyFilteredItems.length}`
    );
  };

  const handleResetFiltersAndSelection = () => {
    pes.resetFilters();
    pes.selected.forEach((id) => pes.toggleSelected(id));
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadDashboardData(), pes.loadItems()]);
  };

  const powerByStatuses = useMemo(() => {
    const result = {};
    STATUS_CHIPS.forEach((chip) => {
      result[chip.key] = sumPower(pes.filteredItems, chip.powerStatuses);
    });
    return result;
  }, [pes.filteredItems]);

  const ovbByDistrict = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = districtName(row);
      map.set(key, (map.get(key) || 0) + toNumber(pick(row, "BRIGADECOUNT")));
    });
    return map;
  }, [rows]);

  const pesByDistrict = useMemo(() => {
    const map = new Map();
    pes.items.forEach((item) => {
      if (!["command_sent", "delay", "en_route", "connected"].includes(item?.effectiveStatus)) return;
      const key = getPesDestinationDistrict(item);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [pes.items]);

  const regionExtraColumns = useMemo(
    () => [
      {
        key: "ovb",
        title: "ОВБ",
        getValue: (district) => ovbByDistrict.get(district) || 0,
      },
      {
        key: "pes",
        title: "ПЭС",
        getValue: (district) => pesByDistrict.get(district) || 0,
      },
    ],
    [ovbByDistrict, pesByDistrict]
  );

  return (
    <div className="dashboard-v2-page pes-module">
      <section className="dashboard-v2-topbar">
        <div className="dashboard-v2-status">
          <span className={pes.canManage ? "dashboard-v2-mode dashboard-v2-mode--manage" : "dashboard-v2-mode"}>
            {pes.canManage ? "Режим управления" : "Режим просмотра"}
          </span>
          {STATUS_CHIPS.map((chip) => (
            <span key={chip.key} className={["dashboard-v2-chip", chip.className].join(" ")}>
              {chip.label}: {pes.filteredSummary[chip.key]}
              <small>{formatPowerKw(powerByStatuses[chip.key])} кВт</small>
            </span>
          ))}
        </div>
        <Space size={6} wrap>
          <Button
            size="small"
            href="https://max.ru/mosoblenergo_pes_bot"
            target="_blank"
            rel="noopener noreferrer"
            icon={<LinkOutlined />}
          >
            MAX бот
          </Button>
          <Button
            size="small"
            href="https://web.max.ru/mosoblenergo_pes_bot"
            target="_blank"
            rel="noopener noreferrer"
            icon={<LinkOutlined />}
          >
            MAX web
          </Button>
          <Button size="small" onClick={() => pes.setHistoryOpen(true)}>
            История операций
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefreshAll} loading={loading || pes.loading}>
            Обновить
          </Button>
        </Space>
      </section>

      {pes.error && <Alert type="error" showIcon message={pes.error} className="dashboard-v2-alert" />}
      {error && <Alert type="error" showIcon message={error} className="dashboard-v2-alert" />}

      <section className="dashboard-v2-command">
        <PesCommandCard
          mode={pes.mode}
          selectedCount={pes.selected.length}
          sending={pes.sending}
          destinationType={pes.destinationType}
          setDestinationType={pes.setDestinationType}
          destinationId={pes.destinationId}
          setDestinationId={pes.setDestinationId}
          loadingDestinations={pes.loadingDestinations}
          destinationOptions={pes.destinationOptions}
          tpBranchFilter={pes.tpBranchFilter}
          setTpBranchFilter={pes.setTpBranchFilter}
          tpPoFilter={pes.tpPoFilter}
          setTpPoFilter={pes.setTpPoFilter}
          tpBranchOptions={pes.tpBranchOptions}
          tpPoOptions={pes.tpPoOptions}
          comment={pes.comment}
          setComment={pes.setComment}
          actionState={pes.actionState}
          runAction={pes.runAction}
        />
        <div className="dashboard-v2-command__tools">
          <Button
            size="small"
            type="primary"
            ghost
            icon={<CheckSquareOutlined />}
            onClick={handleSelectAllDuty}
            disabled={!pes.canManage || !readyFilteredItems.length}
          >
            {allDutySelected ? "Снять выбор дежурных ПЭС" : "Выбрать все дежурные ПЭС"}
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            className="dashboard-v2-excel-button"
            onClick={() => exportPesToXlsx(pes.filteredItems)}
            disabled={!pes.filteredItems.length}
          >
            Выгрузка Excel
          </Button>
        </div>
      </section>

      <PesFiltersCard
        branchOptions={pes.branchOptions}
        branchFilter={pes.branchFilter}
        setBranchFilter={pes.setBranchFilter}
        poOptions={pes.poOptions}
        poFilter={pes.poFilter}
        setPoFilter={pes.setPoFilter}
        statusOptions={[
          { label: "Все статусы", value: "__all__" },
          ...Object.entries(STATUS_META).map(([value, meta]) => ({ label: meta.label, value })),
        ]}
        statusFilter={pes.statusFilter}
        setStatusFilter={pes.setStatusFilter}
        resetFilters={handleResetFiltersAndSelection}
      />

      <section className="dashboard-v2-workspace">
        <div className="dashboard-v2-pes-panel">
          {pes.loading && pes.filteredItems.length === 0 ? (
            <div className="dashboard-v2-loader">
              <Spin />
            </div>
          ) : (
            <PesTilesBoard
              items={pes.filteredItems}
              selected={pes.selected}
              onToggle={pes.toggleSelected}
              selectable={pes.canManage}
              className="pes-board--dashboard-v2"
              branchGroups={DASHBOARD_V2_BRANCH_GROUPS}
              showGroupTitles={false}
            />
          )}
        </div>

        <aside className="dashboard-v2-side">
          <Card className="dashboard-v2-card dashboard-v2-map-card" size="small" title="Карта отключённых потребителей">
            <div className="dashboard-v2-map-box">
              <MapPanel
                height="360px"
                initialState={{ center: [55.751244, 37.618423], zoom: 8 }}
                fiasCodes={fiasCodes}
                url={URL}
                fiasCollection={FIAS_COLLECTION}
                fiasOwners={fiasOwners}
              />
            </div>
          </Card>
          <DashboardV2TodayDuration rows7d={rows7d} />
          <div className="dashboard-v2-dynamics">
            <Dinamica7Days />
          </div>
        </aside>
      </section>

      {loading && rows.length === 0 ? (
        <Skeleton active paragraph={{ rows: 4 }} className="dashboard-v2-table-skeleton" />
      ) : (
        <RegionSZO rowsOpen={rows} loadingExternal={loading} extraColumns={regionExtraColumns} />
      )}

      <PesHistoryDrawer
        open={pes.historyOpen}
        onClose={() => pes.setHistoryOpen(false)}
        historyLoading={pes.historyLoading}
        historyItems={pes.historyItems}
        historyPage={pes.historyPage}
        historyPageSize={pes.historyPageSize}
        historyTotal={pes.historyTotal}
        onRefresh={() => pes.refreshHistory({ nextPage: 1, nextPageSize: pes.historyPageSize })}
        onPageChange={(page, pageSize) => pes.refreshHistory({ nextPage: page, nextPageSize: pageSize })}
      />
    </div>
  );
}
