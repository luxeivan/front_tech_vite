import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Input,
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
import TNModal from "../../main/TNModal";
import JournalOpenModal from "../../journalOpen/JournalOpenModal";
import {
  PLANNED_STATUS_OPTIONS,
  PLANNED_STATUS_VALUES,
  SzoCell,
  buildSzoSummaryFromItem,
  extractGuid,
  formatDateTime,
  getField,
  getPlannedStatusName,
  parseJournalStatuses,
} from "../js/plannedTable.utils";
import "../css/PlannedTable.css";

const defaultPageSize = 10;

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
    violationType: getField(item, "VIOLATION_TYPE") ?? "—",
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
  const [selectedStatuses, setSelectedStatuses] = useState(PLANNED_STATUS_VALUES);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchGuid, setSearchGuid] = useState("");
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
  const showJournal = user?.view_role === "standart";

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
        getTns({ date: nextDate ?? null }),
        loadOpenedCount({ date: nextDate ?? null }),
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
    return list.map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x));
  }, [tns?.data]);

  const filtered = useMemo(() => {
    const qNum = String(searchNumber || "").trim().toLowerCase();
    const qGuid = String(searchGuid || "").trim().toLowerCase();

    return rows
      .filter((item) => {
        const status = getPlannedStatusName(item);
        if (selectedStatuses.length === 0) return true;
        return status ? selectedStatuses.includes(status) : false;
      })
      .filter((item) => {
        const numberStr = String(
          getField(item, "F81_010_NUMB") ??
            getField(item, "F81_010_NUMBER") ??
            getField(item, "number") ??
            ""
        ).toLowerCase();
        const guidStr = String(extractGuid(item) || "").toLowerCase();
        const byNumber = qNum ? numberStr.includes(qNum) : true;
        const byGuid = qGuid ? guidStr.includes(qGuid) : true;
        return byNumber && byGuid;
      })
      .map((item) => mapRow(item, sendStatus));
  }, [rows, selectedStatuses, searchNumber, searchGuid, sendStatus]);

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
          <Typography.Text style={{ whiteSpace: "nowrap" }}>
            Статус ТН:
          </Typography.Text>
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 300 }}
            placeholder="Выберите статус(ы)"
            value={selectedStatuses}
            onChange={(vals) => {
              setSelectedStatuses(vals || []);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={PLANNED_STATUS_OPTIONS}
            dropdownMatchSelectWidth={false}
            maxTagCount={false}
          />
          <Input
            allowClear
            placeholder="№ ТН…"
            value={searchNumber}
            onChange={(e) => {
              setSearchNumber(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            style={{ width: 140 }}
          />
          <Input
            allowClear
            placeholder="GUID…"
            value={searchGuid}
            onChange={(e) => {
              setSearchGuid(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            style={{ width: 240 }}
          />
        </Flex>
        <Flex gap={8} wrap justify="flex-end">
          <Button
            onClick={() => {
              setDate(null);
              setSearchNumber("");
              setSearchGuid("");
              setSelectedStatuses(PLANNED_STATUS_VALUES);
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
