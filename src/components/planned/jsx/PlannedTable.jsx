import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import axios from "axios";
import dayjs from "dayjs";
import ruRU from "antd/locale/ru_RU";
import { ReloadOutlined } from "@ant-design/icons";
import useAuth from "../../../stores/useAuth";
import useData from "../../../stores/useData";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";
import TNModal from "../../emergency/jsx/TNModal";
import JournalOpenModal from "../../journalOpen/JournalOpenModal";
import {
  SzoCell,
  buildSzoSummaryFromItem,
  extractGuid,
  formatDateTime,
  getField,
  isPlannedType,
  getPlannedStatusName,
  parseJournalStatuses,
} from "../js/plannedTable.utils";
import "../css/PlannedTable.css";

const defaultPageSize = 10;
const ALL_BRANCHES = "__all__";
const ALL_PO = "__all__";
const SCOPED_PO_SEPARATOR = ":::";

const SEND_CHANNELS = [
  { key: "edds", label: "ЕДДС" },
  { key: "mes", label: "МЭС" },
  { key: "minenergo", label: "МинЭ" },
  { key: "mosenergosbyt", label: "МосЭсб" },
];

function StatusDot({ ok, label }) {
  const color = ok === true ? "#52c41a" : ok === false ? "#ff4d4f" : "#d9d9d9";
  return (
    <Tooltip
      title={`${label}: ${
        ok === true ? "отправлено" : ok === false ? "не отправлено" : "нет данных"
      }`}
    >
      <span className="planned-dot" style={{ background: color }} />
    </Tooltip>
  );
}

function SendDots({ st }) {
  const s = st || {};
  return (
    <Space size={8}>
      {SEND_CHANNELS.map((c) => (
        <StatusDot key={c.key} ok={s[c.key]} label={c.label} />
      ))}
    </Space>
  );
}

function WelcomeHeader({ user, totalOpened, loadingOpened }) {
  const name =
    user?.fullName ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Пользователь";

  return (
    <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Добро пожаловать, {name}
      </Typography.Title>
      <Typography.Title level={4} style={{ marginTop: 0, fontWeight: 500 }}>
        Всего открытых ТН: {loadingOpened ? <Spin size="small" /> : totalOpened}
      </Typography.Title>
    </div>
  );
}

function getCreateTs(item) {
  const raw = getField(item, "F81_060_EVENTDATETIME") || getField(item, "createDateTime");
  const ts = dayjs(raw).valueOf();
  return Number.isFinite(ts) ? ts : 0;
}

function ruSort(a, b) {
  return String(a).localeCompare(String(b), "ru", {
    sensitivity: "base",
    numeric: true,
  });
}

function makeScopedPoValue(branch, po) {
  return `${branch}${SCOPED_PO_SEPARATOR}${po}`;
}

function parseScopedPoValue(value) {
  if (typeof value !== "string" || !value.includes(SCOPED_PO_SEPARATOR)) return null;
  const [branch, po] = value.split(SCOPED_PO_SEPARATOR);
  return { branch, po };
}

function mapRow(item, sendStatus) {
  const plannedNum =
    getField(item, "F81_010_NUMB") ??
    getField(item, "F81_010_NUMBER") ??
    getField(item, "number");
  const guid = extractGuid(item);
  const numberKey = plannedNum != null ? String(plannedNum) : null;
  const sendByGuid = guid ? sendStatus.byGuid[String(guid).toLowerCase()] : null;
  const send = sendByGuid || (numberKey ? sendStatus.byNumber[numberKey] : null);

  const documentId =
    getField(item, "documentId") ||
    getField(item, "guid") ||
    getField(item, "VIOLATION_GUID_STR") ||
    getField(item, "id");

  return {
    key: getField(item, "id") ?? documentId,
    documentId,
    number: plannedNum ?? "—",
    violationType: Number(getField(item, "BASE_TYPE")) === 1 ? "Плановая" : "—",
    startPlan: formatDateTime(getField(item, "F81_060_EVENTDATETIME")),
    startFact: formatDateTime(getField(item, "STARTDATETIME")),
    endPlan: formatDateTime(getField(item, "F81_070_RESTOR_SUPPLAYDATETIME")),
    endFact: formatDateTime(getField(item, "F81_290_RECOVERYDATETIME")),
    branch: getField(item, "OWN_SCNAME") ?? "—",
    po: getField(item, "SCNAME") ?? "—",
    objectName: getField(item, "F81_041_ENERGOOBJECTNAME") ?? "—",
    addressList: getField(item, "ADDRESS_LIST") ?? "—",
    description: getField(item, "BRIGADE_ACTION") ?? "—",
    statusName: getPlannedStatusName(item),
    szoTags: buildSzoSummaryFromItem(item),
    send,
    createTs: getCreateTs(item),
    guid,
  };
}

export default function PlannedTable() {
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: defaultPageSize,
  });
  const [date, setDate] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(ALL_BRANCHES);
  const [selectedPo, setSelectedPo] = useState(ALL_PO);
  const [sorter, setSorter] = useState({
    field: "startPlan",
    order: "descend",
  });
  const [modalDocId, setModalDocId] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState({ byGuid: {}, byNumber: {} });
  const [isSendStatusLoading, setIsSendStatusLoading] = useState(false);
  const [hasLoadedSendStatus, setHasLoadedSendStatus] = useState(false);
  const lastDataKeyRef = useRef(null);
  const sendStatusInFlightRef = useRef(false);

  const user = useAuth((s) => s.user);
  const { tns, getTns, isLoadingTns, openedCount, loadOpenedCount, loadingOpenedCount } =
    useData((s) => s);
  const showJournal = hasFeatureAccess(user?.view_role, "journal");

  const loadSendStatus = useCallback(async ({ force = false } = {}) => {
    if (sendStatusInFlightRef.current && !force) return;
    try {
      sendStatusInFlightRef.current = true;
      setIsSendStatusLoading(true);
      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;
      const params = {
        "pagination[page]": 1,
        "pagination[pageSize]": 1,
        "sort[0]": "updatedAt:desc",
      };
      const { data: payload } = await axios.get(url, { params });
      const firstItem =
        Array.isArray(payload?.data) && payload.data.length > 0
          ? payload.data[0]
          : null;
      let arr = firstItem?.attributes?.data ?? firstItem?.data ?? [];
      if (!Array.isArray(arr) && typeof arr === "string") {
        arr = arr.split(/\r?\n/).filter(Boolean);
      }
      setSendStatus(parseJournalStatuses(arr));
      setHasLoadedSendStatus(true);
    } catch {
      setSendStatus({ byGuid: {}, byNumber: {} });
      setHasLoadedSendStatus(true);
    } finally {
      sendStatusInFlightRef.current = false;
      setIsSendStatusLoading(false);
    }
  }, []);

  const fetchPrimaryData = useCallback(
    async ({ nextDate = date, force = false } = {}) => {
      const key = nextDate ? dayjs(nextDate).format("YYYY-MM-DD") : "all";
      if (!force && lastDataKeyRef.current === key) return;
      lastDataKeyRef.current = key;
      await Promise.all([
        getTns({ date: nextDate ?? null, baseType: 1 }),
        loadOpenedCount({ date: nextDate ?? null, baseType: 1 }),
      ]);
    },
    [date, getTns, loadOpenedCount]
  );

  useEffect(() => {
    fetchPrimaryData({ nextDate: date, force: false });
  }, [date, fetchPrimaryData]);

  useEffect(() => {
    loadSendStatus({ force: false });
  }, [loadSendStatus]);

  const rows = useMemo(() => {
    const list = Array.isArray(tns?.data) ? tns.data : [];
    return list
      .map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x))
      .filter((item) => isPlannedType(item));
  }, [tns?.data]);

  const poOptions = useMemo(() => {
    if (selectedBranch !== ALL_BRANCHES) {
      const values = Array.from(
        new Set(
          rows
            .filter((item) => String(getField(item, "OWN_SCNAME") || "").trim() === selectedBranch)
            .map((item) => String(getField(item, "SCNAME") || "").trim())
            .filter(Boolean)
        )
      ).sort(ruSort);

      return [
        { label: "Все ПО", value: ALL_PO },
        ...values.map((po) => ({
          label: po,
          value: makeScopedPoValue(selectedBranch, po),
        })),
      ];
    }

    const byBranch = new Map();
    rows.forEach((item) => {
      const branch = String(getField(item, "OWN_SCNAME") || "").trim();
      const po = String(getField(item, "SCNAME") || "").trim();
      if (!branch || !po) return;
      if (!byBranch.has(branch)) byBranch.set(branch, new Set());
      byBranch.get(branch).add(po);
    });

    const groups = Array.from(byBranch.keys())
      .sort(ruSort)
      .map((branch) => ({
        label: branch,
        options: Array.from(byBranch.get(branch))
          .sort(ruSort)
          .map((po) => ({
            label: po,
            value: makeScopedPoValue(branch, po),
          })),
      }));

    return [{ label: "Все ПО", value: ALL_PO }, ...groups];
  }, [rows, selectedBranch]);

  const branchOptions = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((item) => String(getField(item, "OWN_SCNAME") || "").trim()).filter(Boolean))
    ).sort(ruSort);

    return [{ label: "Все филиалы", value: ALL_BRANCHES }, ...values.map((branch) => ({
      label: branch,
      value: branch,
    }))];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((item) => {
        const branch = String(getField(item, "OWN_SCNAME") || "").trim();
        if (selectedBranch !== ALL_BRANCHES && branch !== selectedBranch) return false;

        if (selectedPo !== ALL_PO) {
          const po = String(getField(item, "SCNAME") || "").trim();
          const scoped = parseScopedPoValue(selectedPo);
          if (scoped) {
            if (branch !== scoped.branch || po !== scoped.po) return false;
          } else if (po !== selectedPo) {
            return false;
          }
        }

        return true;
      })
      .map((item) => mapRow(item, sendStatus));
  }, [rows, selectedBranch, selectedPo, sendStatus]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmpStr = (a = "", b = "") =>
      String(a).localeCompare(String(b), "ru", {
        numeric: true,
        sensitivity: "base",
      });
    arr.sort((a, b) => {
      let res = 0;
      switch (sorter.field) {
        case "number":
          res = (Number(a.number) || 0) - (Number(b.number) || 0);
          break;
        case "startPlan":
          res = (a.createTs || 0) - (b.createTs || 0);
          break;
        case "branch":
          res = cmpStr(a.branch, b.branch);
          break;
        case "po":
          res = cmpStr(a.po, b.po);
          break;
        case "objectName":
          res = cmpStr(a.objectName, b.objectName);
          break;
        case "statusName":
          res = cmpStr(a.statusName, b.statusName);
          break;
        default:
          res = (a.createTs || 0) - (b.createTs || 0);
      }
      return sorter.order === "descend" ? -res : res;
    });
    return arr;
  }, [filtered, sorter]);

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const dataSource = sorted.slice(startIndex, startIndex + pagination.pageSize);

  const exportToExcel = useCallback(() => {
    const rowsToExport = sorted.map((row) => ({
      "№": row.number,
      "Вид заявки": row.violationType,
      "Начало работ (план)": row.startPlan,
      "Начало работ (факт)": row.startFact,
      "Окончание работ (план)": row.endPlan,
      "Окончание работ (факт)": row.endFact,
      "Филиал": row.branch,
      "ПО": row.po,
      "Объект": row.objectName,
      "Адреса": row.addressList,
      "СЗО": Array.isArray(row.szoTags) && row.szoTags.length > 0
        ? row.szoTags.map((tag) => `${tag.label}: ${tag.count}`).join("; ")
        : "—",
      "Описание": row.description,
      "Статус": row.statusName,
      "Отправки": row.send
        ? SEND_CHANNELS.map((channel) => `${channel.label}: ${row.send[channel.key] === true ? "да" : row.send[channel.key] === false ? "нет" : "—"}`).join("; ")
        : "—",
    }));

    const headers = Object.keys(rowsToExport[0] || {
      "№": "",
      "Вид заявки": "",
      "Начало работ (план)": "",
      "Начало работ (факт)": "",
      "Окончание работ (план)": "",
      "Окончание работ (факт)": "",
      "Филиал": "",
      "ПО": "",
      "Объект": "",
      "Адреса": "",
      "СЗО": "",
      "Описание": "",
      "Статус": "",
      "Отправки": "",
    });

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");

    const headHtml = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
    const bodyHtml = rowsToExport
      .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`)
      .join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table border="1">
            <thead>${headHtml}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    const datePart = date ? dayjs(date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    link.href = objectUrl;
    link.download = `planovye-otklyucheniya-${datePart}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, [sorted, date]);

  const columns = [
    {
      title: "№",
      dataIndex: "number",
      key: "number",
      width: 58,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "number" ? sorter.order : null,
    },
    {
      title: "Вид заявки",
      dataIndex: "violationType",
      key: "violationType",
      width: 82,
      render: (v) => <Tag>{v || "—"}</Tag>,
      ellipsis: true,
    },
    {
      title: "Начало работ",
      children: [
        {
          title: "план",
          dataIndex: "startPlan",
          key: "startPlan",
          width: 112,
          sorter: true,
          sortOrder: sorter.field === "startPlan" ? sorter.order : null,
        },
        {
          title: "факт",
          dataIndex: "startFact",
          key: "startFact",
          width: 112,
        },
      ],
    },
    {
      title: "Окончание работ",
      children: [
        {
          title: "план",
          dataIndex: "endPlan",
          key: "endPlan",
          width: 112,
        },
        {
          title: "факт",
          dataIndex: "endFact",
          key: "endFact",
          width: 112,
        },
      ],
    },
    {
      title: "Филиал",
      dataIndex: "branch",
      key: "branch",
      width: 118,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "branch" ? sorter.order : null,
    },
    {
      title: "ПО",
      dataIndex: "po",
      key: "po",
      width: 112,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "po" ? sorter.order : null,
    },
    {
      title: "Объект",
      dataIndex: "objectName",
      key: "objectName",
      width: 152,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "objectName" ? sorter.order : null,
    },
    {
      title: "Адреса",
      dataIndex: "addressList",
      key: "addressList",
      width: 136,
      ellipsis: true,
    },
    {
      title: "СЗО",
      dataIndex: "szoTags",
      key: "szo",
      width: 162,
      render: (tags) => <SzoCell tags={tags} />,
      ellipsis: true,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      width: 132,
      ellipsis: true,
    },
    {
      title: "Статус",
      dataIndex: "statusName",
      key: "statusName",
      width: 84,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "statusName" ? sorter.order : null,
    },
    {
      title: "Отправки",
      dataIndex: "send",
      key: "send",
      width: 108,
      render: (st) => <SendDots st={st} />,
      ellipsis: true,
    },
  ];

  return (
    <ConfigProvider locale={ruRU}>
      <WelcomeHeader
        user={user}
        totalOpened={openedCount}
        loadingOpened={loadingOpenedCount}
      />

      <Flex
        justify="space-between"
        align="center"
        style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
      >
        <Flex gap={8} wrap style={{ rowGap: 8 }}>
          <DatePicker
            value={date}
            format={"DD.MM.YYYY"}
            onChange={(v) => {
              setDate(v);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Выберите дату"
            allowClear
          />
          <Select
            allowClear
            style={{ minWidth: 220 }}
            placeholder="Все филиалы"
            value={selectedBranch}
            onChange={(val) => {
              setSelectedBranch(val || ALL_BRANCHES);
              setSelectedPo(ALL_PO);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={branchOptions}
            dropdownMatchSelectWidth={false}
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 240 }}
            placeholder="Все ПО"
            value={selectedPo}
            onChange={(val) => {
              setSelectedPo(val || ALL_PO);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={poOptions}
            dropdownMatchSelectWidth={false}
          />
        </Flex>
        <Flex gap={8} wrap justify="flex-end">
          <Button onClick={exportToExcel}>Выгрузка в Excel</Button>
          <Button
            onClick={() => {
              setDate(null);
              setSelectedBranch(ALL_BRANCHES);
              setSelectedPo(ALL_PO);
              setPagination({ page: 1, pageSize: defaultPageSize });
              lastDataKeyRef.current = null;
              fetchPrimaryData({ nextDate: null, force: true });
              loadSendStatus({ force: true });
            }}
          >
            Сброс
          </Button>
          {showJournal && (
            <Button onClick={() => setIsJournalOpen(true)}>Журнал отправки</Button>
          )}
          <Button
            onClick={() => {
              lastDataKeyRef.current = null;
              fetchPrimaryData({ nextDate: date, force: true });
              loadSendStatus({ force: true });
            }}
            disabled={isLoadingTns || isSendStatusLoading}
          >
            <ReloadOutlined />
          </Button>
        </Flex>
      </Flex>

      <Table
        className="planned-table--compact"
        size="small"
        tableLayout="fixed"
        loading={isLoadingTns}
        rowKey="key"
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        onChange={(p, f, s) => {
          const info = Array.isArray(s) ? s[0] : s;
          if (info && info.field) {
            setSorter({ field: info.field, order: info.order || "ascend" });
          } else {
            setSorter({ field: "startPlan", order: "descend" });
          }
        }}
        onRow={(record) => ({
          style: { cursor: "pointer" },
          onClick: () => setModalDocId(record.documentId),
        })}
      />

      <div style={{ marginTop: 10 }}>
        <Pagination
          align="center"
          total={sorted.length}
          current={pagination.page}
          pageSize={pagination.pageSize}
          onChange={(page, pageSize) => setPagination({ page, pageSize })}
          showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
        />
      </div>

      <TNModal
        open={modalDocId}
        onClose={() => {
          setModalDocId(false);
          setTimeout(() => {
            lastDataKeyRef.current = null;
            fetchPrimaryData({ nextDate: date, force: true });
            loadSendStatus({ force: true });
          }, 0);
        }}
        documentId={modalDocId}
        mode="planned"
      />

      <JournalOpenModal
        open={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
      />
    </ConfigProvider>
  );
}
