import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Pagination,
  Select,
  Spin,
  Table,
  Typography,
  Tag,
  Tooltip,
  Space,
  Input,
} from "antd";
import React, { useEffect, useState } from "react";
import axios from "axios";
import useData from "../../../stores/useData";
import dayjs from "dayjs";
import { ReloadOutlined } from "@ant-design/icons";
import useAuth from "../../../stores/useAuth";
import TableTNActionsBar from "./TableTNActionsBar";
import TNModal from "./TNModal";
import JournalOpenModal from "../../journalOpen/JournalOpenModal";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";
import ruRU from "antd/locale/ru_RU";
import "dayjs/locale/ru";
dayjs.locale("ru");

const EMERGENCY_VIOLATION_TYPE_EXCLUDE = "П";

const getStatusName = (item) => {
  const a = item?.attributes;
  const possible = [
    item?.STATUS_NAME,
    a?.STATUS_NAME,
    item?.data?.STATUS_NAME,
    item?.data?.data?.STATUS_NAME,
    item?.status_name,
    item?.data?.data?.status_name,
    a?.status_name,
  ];
  for (const v of possible) {
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  return null;
};

const getCreateDate = (item) =>
  item?.createDateTime ??
  item?.attributes?.createDateTime ??
  item?.data?.createDateTime ??
  item?.data?.data?.createDateTime ??
  item?.data?.data?.F81_060_EVENTDATETIME ??
  item?.attributes?.data?.data?.F81_060_EVENTDATETIME ??
  null;

const getRecoveryDate = (item) =>
  item?.recoveryFactDateTime ??
  item?.attributes?.recoveryFactDateTime ??
  item?.data?.recoveryFactDateTime ??
  item?.data?.data?.recoveryFactDateTime ??
  item?.data?.data?.F81_290_RECOVERYDATETIME ??
  item?.attributes?.data?.data?.F81_290_RECOVERYDATETIME ??
  null;

const getViolationType = (item) => {
  const a = item?.attributes;
  const possible = [
    item?.VIOLATION_TYPE,
    a?.VIOLATION_TYPE,
    item?.data?.VIOLATION_TYPE,
    item?.data?.data?.VIOLATION_TYPE,
    item?.violation_type,
    a?.violation_type,
  ];
  for (const v of possible) {
    if (typeof v === "string" && v.trim()) return v.trim().toUpperCase();
  }
  return null;
};

const FINAL_STATUSES = new Set(["запитана", "закрыта", "удалена"]);

function getDurationHighlightClass(item) {
  const startRaw = getCreateDate(item);
  const startTs = dayjs(startRaw).valueOf();
  if (!Number.isFinite(startTs) || startTs <= 0) return "";

  const status = getStatusName(item);
  const isFinal = status ? FINAL_STATUSES.has(status) : false;
  const recoveryRaw = getRecoveryDate(item);
  const recoveryTs = dayjs(recoveryRaw).valueOf();

  let endTs = Date.now();
  if (Number.isFinite(recoveryTs) && recoveryTs > 0) {
    endTs = recoveryTs;
  } else if (isFinal) {
    // Для финальных статусов без фактического времени восстановления подсветку не применяем.
    return "";
  }

  if (endTs <= startTs) return "";
  const durationHours = (endTs - startTs) / (60 * 60 * 1000);

  if (durationHours > 4) return "tn-row-duration-red";
  if (durationHours > 2) return "tn-row-duration-orange";
  return "";
}

function isGuid36(s) {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

function extractGuid(item) {
  const src = item?.attributes ? { id: item.id, ...item.attributes } : item;
  const candidates = [
    src?.guid,
    src?.VIOLATION_GUID_STR,
    src?.documentId,
    item?.guid,
    item?.VIOLATION_GUID_STR,
    item?.documentId,
    item?.data?.data?.VIOLATION_GUID_STR,
    item?.data?.data?.guid,
  ].filter(isGuid36);
  return candidates.length ? String(candidates[0]).toLowerCase() : null;
}

const isOpen = (item) => {
  const a = item?.attributes;
  const v =
    item?.isActive ??
    a?.isActive ??
    item?.data?.isActive ??
    item?.data?.data?.isActive ??
    (a && a.isActive && a.isActive.value);

  return v === true || v === 1 || v === "true";
};

// 4 варианта статусов ТН
const STATUS_OPTIONS = [
  { label: "Открыта", value: "открыта" },
  { label: "Запитана", value: "запитана" },
  { label: "Удалена", value: "удалена" },
  { label: "Закрыта", value: "закрыта" },
];

function WelcomeHeader({ totalOpened, loadingOpened }) {
  const { user, getUserMe } = useAuth((s) => s);
  React.useEffect(() => {
    // getUserMe сам проверит наличие JWT и не пойдёт в сеть, если его нет
    getUserMe?.();
  }, [getUserMe]);

  const name =
    user?.fullName ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Пользователь";

  return (
    <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
      {/* <Typography.Title level={5} style={{ marginBottom: 4, color: "red" }}>
        Коллеги, у нас закончились лимиты обращений к DaData, поэтому карта на
        ДашБорде не будет работать (лимиты раз в сутки обновляются){" "}
      </Typography.Title> */}
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Добро пожаловать, {name}
      </Typography.Title>
      {/* ЗАКОМЕНТИРОВАННЫЙ КОД */}
      <Typography.Title level={4} style={{ marginTop: 0, fontWeight: 500 }}>
        Всего открытых ТН: {loadingOpened ? <Spin size="small" /> : totalOpened}
      </Typography.Title>
    </div>
  );
}

function FiltersBar({
  dateValue,
  onDateChange,
  selectedStatuses,
  onStatusChange,
  rightExtra,
  searchNumber,
  onSearchNumberChange,
  searchGuid,
  onSearchGuidChange,
}) {
  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
    >
      <Flex gap={8} wrap style={{ rowGap: 8 }}>
        <DatePicker
          value={dateValue}
          format={"DD.MM.YYYY"}
          onChange={onDateChange}
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
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
          dropdownMatchSelectWidth={false}
          maxTagCount={false}
        />
        <Input
          allowClear
          placeholder="№ ТН…"
          value={searchNumber}
          onChange={(e) => onSearchNumberChange(e.target.value)}
          style={{ width: 140 }}
        />
        <Input
          allowClear
          placeholder="GUID…"
          value={searchGuid}
          onChange={(e) => onSearchGuidChange(e.target.value)}
          style={{ width: 240 }}
        />
      </Flex>
      {rightExtra}
    </Flex>
  );
}

// --- СЗО: извлечение по типам из raw.SocialObjects + фолбэки по *_ALL полям ---
const SZO_ORDER = [
  "mkd",
  "schools",
  "kindergartens",
  "hospitals",
  "polyclinics",
  "boiler",
  "water",
  "kns",
  "snt",
];

const SZO_META = {
  mkd: { label: "МКД", color: "default" },
  schools: { label: "Школы", color: "blue" },
  kindergartens: { label: "Детсады", color: "geekblue" },
  hospitals: { label: "Больницы", color: "red" },
  polyclinics: { label: "Поликлиники", color: "magenta" },
  boiler: { label: "Котельные", color: "orange" },
  water: { label: "ВЗУ", color: "green" },
  kns: { label: "КНС", color: "volcano" },
  snt: { label: "СНТ", color: "purple" },
};

function s(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function getRawData(item) {
  return item?.data?.data ?? item?.data ?? item ?? {};
}

function classifySocialTyp(t) {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hospitals";
  if (x.includes("поликлин")) return "polyclinics";
  if (x.includes("котель")) return "boiler";
  if (x.includes("взу") || x.includes("скваж")) return "water";
  if (x.includes("кнс")) return "kns";
  if (x.includes("снт")) return "snt";
  return null;
}

function buildSzoSummaryFromItem(item) {
  const raw = getRawData(item);
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];

  // Заготовка
  const base = {
    mkd: { count: 0, names: [] },
    schools: { count: 0, names: [] },
    kindergartens: { count: 0, names: [] },
    hospitals: { count: 0, names: [] },
    polyclinics: { count: 0, names: [] },
    boiler: { count: 0, names: [] },
    water: { count: 0, names: [] },
    kns: { count: 0, names: [] },
    snt: { count: 0, names: [] },
  };

  const seenByKey = {
    mkd: new Set(),
    schools: new Set(),
    kindergartens: new Set(),
    hospitals: new Set(),
    polyclinics: new Set(),
    boiler: new Set(),
    water: new Set(),
    kns: new Set(),
    snt: new Set(),
  };

  if (socials.length) {
    // Классифицируем каждый объект
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      // уникальность по FIAS или имени
      const uniq =
        s(it?.FIAS)?.toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seenByKey[key].has(uniq)) return;
      seenByKey[key].add(uniq);

      base[key].count += 1;
      const name = s(it?.Name);
      if (name) base[key].names.push(name);
    });
  } else {
    // Фолбэк по суммарным *_ALL полям, если массива нет
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    base.mkd.count = num(raw.MKD_ALL);
    base.schools.count = num(raw.SCHOOLS_ALL);
    base.kindergartens.count = num(raw.KINDERGARTENS_ALL);
    base.hospitals.count = num(raw.HOSPITALS_ALL);
    base.polyclinics.count = num(raw.CLINICS_ALL);
    base.boiler.count = num(raw.BOILER_ALL);
    // ВЗУ/скважины встречались как WELLS_ALL
    base.water.count = num(raw.WELLS_ALL);
    base.kns.count = num(raw.KNS_ALL);
    // СНТ обычно только в SocialObjects — оставим 0
  }

  // Сконвертируем в компактный массив для UI
  const tags = [];
  for (const key of SZO_ORDER) {
    const { count, names } = base[key];
    if (count > 0) {
      tags.push({
        key,
        label: SZO_META[key].label,
        color: SZO_META[key].color,
        count,
        names: names.slice(0, 10), // короткий список в тултип
        more: Math.max(0, names.length - 10),
      });
    }
  }
  return tags;
}

function SzoCell({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0)
    return <span style={{ color: "#999" }}>—</span>;
  return (
    <Space size={[6, 6]} wrap>
      {tags.map((t) => {
        const title = t.names.length
          ? `${t.label}: ${t.names.join(", ")}${
              t.more ? ` и ещё +${t.more}` : ""
            }`
          : `${t.label}: ${t.count} шт.`;
        return (
          <Tooltip key={t.key} title={title} mouseEnterDelay={0.15}>
            <Tag color={t.color} style={{ marginInlineEnd: 0 }}>
              {t.label}: {t.count}
            </Tag>
          </Tooltip>
        );
      })}
    </Space>
  );
}

// Проверка что всё окс работает

// === Journal send-status helpers ===
function parseDateFromJournalLine(line) {
  if (!line || typeof line !== "string") return 0;
  const m = line.match(/-\s(\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2})\s-/);
  if (!m) return 0;
  const [dd, mm, yyyy, hh, min, ss] = m[1]
    .replace(/\./g, " ")
    .replace(/:/g, " ")
    .split(" ")
    .map(Number);
  return new Date(yyyy, mm - 1, dd, hh, min, ss).getTime();
}

function normalizeChannelName(raw) {
  const x = String(raw || "").toLowerCase();
  if (x.includes("едд")) return "edds"; // ЕДДС
  if (x.includes("мэс")) return "mes";  
  if (x.includes("мин") && x.includes("энерг")) return "minenergo"; 
  if (x.includes("сбыт") || x.includes("мосэнергосб")) return "mosenergosbyt"; 
  return null;
}

function parseJournalStatuses(lines) {
  // returns { byGuid: {guid: {edds?:boolean,mes?:boolean,minenergo?:boolean,mosenergosbyt?:boolean}}, byNumber: {num: same} }
  const byGuid = {};
  const byNumber = {};
  const upsert = (dict, key, ch, ok, ts) => {
    if (!key) return;
    const prev = dict[key] || {};
    const prevTs = prev.__ts?.[ch] || 0;
    if (!prev.__ts) prev.__ts = {};
    if (ts >= prevTs) {
      prev[ch] = ok;
      prev.__ts[ch] = ts;
    }
    dict[key] = prev;
  };

  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (typeof line !== "string" || !line.trim()) return;
    const ts = parseDateFromJournalLine(line);
    const num = (line.match(/№\s*(\d+)/i) || [])[1] || null;
    const guidRaw = (line.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0] || null;
    const guid = isGuid36(guidRaw) ? guidRaw.toLowerCase() : null;
    const ch = normalizeChannelName((line.match(/-\s*\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2}\s*-\s*([^\-\n\r:]+?)\s*-/) || [])[1]);
    if (!ch) return;
    const isError = /(ошиб|error|fail|не\s*отправ)/i.test(line);
    const ok = !isError; // если есть запись и нет явной ошибки — считаем отправленным
    if (guid) upsert(byGuid, String(guid), ch, ok, ts);
    if (num) upsert(byNumber, String(num), ch, ok, ts);
  });

  // удаляем служебные таймстампы перед возвратом
  const strip = (obj) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      const c = { ...v };
      delete c.__ts;
      out[k] = c;
    });
    return out;
  };

  return { byGuid: strip(byGuid), byNumber: strip(byNumber) };
}

const SEND_CHANNELS = [
  { key: "edds", label: "ЕДДС" },
  { key: "mes", label: "МЭС" },
  { key: "minenergo", label: "МинЭ" },
  { key: "mosenergosbyt", label: "МосЭсб" },
];

function StatusDot({ ok, label }) {
  const color = ok === true ? "#52c41a" : ok === false ? "#ff4d4f" : "#d9d9d9";
  return (
    <Tooltip title={`${label}: ${ok === true ? "отправлено" : ok === false ? "не отправлено" : "нет данных"}`}>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />
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
// === /Journal send-status helpers ===

const defaultPageSize = 10;
const defaultPage = 1;

export default function TableTN() {
  const { tns, getTns, isLoadingTns, openedCount, loadOpenedCount, loadingOpenedCount } = useData((store) => store);
  const [pagination, setPagination] = useState({
    page: defaultPage,
    pageSize: defaultPageSize,
  });
  const [isOpenModalTN, setIsOpenModalTN] = useState(false);
  const [date, setDate] = useState(null);
  const [sound, setSound] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(["открыта"]);

  const [refreshLocked, setRefreshLocked] = useState(false); // флажок блокировки автообновлений
  const [searchNumber, setSearchNumber] = useState("");
  const [searchGuid, setSearchGuid] = useState("");
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [highlightGuids, setHighlightGuids] = useState(new Set());
  const [sorter, setSorter] = useState({ field: "createDateTime", order: "descend" });
  const audioRef = React.useRef(null);
  const prevOpenGuidsRef = React.useRef(new Set());
  const firstScanDoneRef = React.useRef(false);

  // === Journal send status state ===
  const { user, getUserMe } = useAuth((s) => s);
  const showJournal = hasFeatureAccess(user?.view_role, "journal");
  const [sendStatus, setSendStatus] = useState({ byGuid: {}, byNumber: {} });
  const loadSendStatus = React.useCallback(async () => {
    try {
      // обновим сессию/пользователя; интерцептор сам подмешает JWT
      await getUserMe?.();
      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;
      const params = {
        'pagination[page]': 1,
        'pagination[pageSize]': 1,
        'sort[0]': 'updatedAt:desc',
      };
      const { data: payload } = await axios.get(url, { params });
      const firstItem = Array.isArray(payload?.data) && payload.data.length > 0 ? payload.data[0] : null;
      let arr = firstItem?.attributes?.data ?? firstItem?.data ?? [];
      if (!Array.isArray(arr) && typeof arr === 'string') {
        arr = arr.split(/\r?\n/).filter(Boolean);
      }
      setSendStatus(parseJournalStatuses(arr));
    } catch (e) {
      // молча игнорируем сбой журнала, чтобы таблица не падала
      setSendStatus({ byGuid: {}, byNumber: {} });
    }
  }, [getUserMe]);

  React.useEffect(() => {
    loadSendStatus();
  }, [loadSendStatus]);

  const handleStatusChange = (vals) => {
    setSelectedStatuses(vals || []);
    setPagination((p) => ({ ...p, page: 1 }));
    console.log("[filters] режим: Статусы =", vals || []);
  };

  // --- removed openedCount, loadingOpened, totalByDate, headerTotal memoizations

  useEffect(() => {
    getTns({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
    loadOpenedCount({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
  }, [date, selectedStatuses, getTns, loadOpenedCount]);

  useEffect(() => {
    if (isLoadingTns) return;
    const all = Array.isArray(tns?.data) ? tns.data : [];
    if (all.length === 0) return;

    const opened = all.filter((i) => getStatusName(i) === "открыта");
    // console.log(`[filters] открытых ТН: ${opened.length}`);
    opened.forEach((i) => {
      const id = i?.documentId || i?.id;
      // console.log(`ТН ${id}: статус = "открыта"`);
    });

    all.forEach((tn, i) => {});
    console.log("Всего ТН:", all.length);
  }, [tns?.data, isLoadingTns]);

  useEffect(() => {
    setRefreshLocked(Boolean(isOpenModalTN));
  }, [isOpenModalTN]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (sound) {
      try {
        a.muted = true;
        a.play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      } catch {}
    }
  }, [sound]);

  // === LIVE ПОДПИСКА (SSE) ===
  useEffect(() => {
    const base = import.meta.env.VITE_URL_BACKEND_SERVICES;
    const url = `${base}/services/event`;
    let es;
    let timer = null;

    const scheduleRefresh = (delay = 800) => {
      clearTimeout(timer);
      if (refreshLocked) return;
      timer = setTimeout(() => {
        if (!refreshLocked) {
          getTns({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
          loadOpenedCount({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
          loadSendStatus();
        }
      }, delay);
    };

    const connect = () => {
      es = new EventSource(url, { withCredentials: false });

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          scheduleRefresh();
        } catch (e) {
          console.log("Ошибка срабатывания вебхука", e);
        }
      };

      es.onerror = () => {
        // console.warn("⚠️ SSE ошибка/разрыв, переподключение через 3с…");
        try {
          es.close();
        } catch {}
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(timer);
      try {
        es?.close();
      } catch {}
    };
  }, [getTns, loadSendStatus, refreshLocked, date, loadOpenedCount]);

  // === /LIVE ПОДПИСКА ===

  const addHighlight = React.useCallback((g) => {
    if (!g) return;
    setHighlightGuids((prev) => {
      const next = new Set(prev);
      if (next.has(g)) return next;
      next.add(g);
      setTimeout(() => {
        setHighlightGuids((prev2) => {
          const n = new Set(prev2);
          n.delete(g);
          return n;
        });
      }, 60_000);
      return next;
    });
  }, []);

  useEffect(() => {
    const list = Array.isArray(tns?.data) ? tns.data : [];
    const opened = list.filter((i) => getStatusName(i) === "открыта" || isOpen(i));

    const currSet = new Set();
    for (const it of opened) {
      const g = extractGuid(it);
      if (g) currSet.add(g);
    }

    const prevSet = prevOpenGuidsRef.current;
    if (!firstScanDoneRef.current) {
      firstScanDoneRef.current = true;
      prevOpenGuidsRef.current = currSet;
      return;
    }

    const newOnes = [];
    for (const g of currSet) {
      if (!prevSet.has(g)) newOnes.push(g);
    }

    if (newOnes.length) {
      if (sound && audioRef.current) {
        try {
          const a = audioRef.current;
          a.currentTime = 0;
          a.play().catch(() => {});
        } catch {}
      }
      newOnes.forEach(addHighlight);
    }

    prevOpenGuidsRef.current = currSet;
  }, [tns?.data, sound, addHighlight]);
  // === /LIVE ПОДПИСКА ===

  const listRaw = Array.isArray(tns?.data) ? tns.data : [];
  const listByDate = listRaw.filter((item) => {
    if (getViolationType(item) === EMERGENCY_VIOLATION_TYPE_EXCLUDE) return false;
    const d = getCreateDate(item);
    return date ? dayjs(d).isSame(date, "day") : true;
  });
  const listFiltered = listByDate.filter((item) => {
    // --- status filter ---
    const s = getStatusName(item);
    const openSelected =
      selectedStatuses.length === 1 && selectedStatuses[0] === "открыта";
    const statusOk =
      selectedStatuses.length === 0
        ? true
        : openSelected
        ? isOpen(item) || s === "открыта"
        : s
        ? selectedStatuses.includes(s)
        : false;

    if (!statusOk) return false;

    // --- number + guid search ---
    const src = item?.attributes ? { id: item.id, ...item.attributes } : item;
    const numStr = (
      src?.number != null ? String(src.number) : ""
    ).toLowerCase();

    const guidCandidates = [
      src?.guid,
      src?.VIOLATION_GUID_STR,
      src?.documentId,
      item?.guid,
      item?.VIOLATION_GUID_STR,
      item?.documentId,
      item?.data?.data?.VIOLATION_GUID_STR,
      item?.data?.data?.guid,
    ].filter(Boolean);

    const guidStr = (
      guidCandidates[0] ? String(guidCandidates[0]) : ""
    ).toLowerCase();

    const qNum = String(searchNumber || "")
      .trim()
      .toLowerCase();
    const qGuid = String(searchGuid || "")
      .trim()
      .toLowerCase();

    const numberOk = qNum ? numStr.includes(qNum) : true;
    const guidOk = qGuid ? guidStr.includes(qGuid) : true;

    return numberOk && guidOk;
  });

  // 1) Сформировать полноценные строки (включая ключи сортировки)
  const rowsAll = listFiltered.map((item) => {
    const src = item?.attributes ? { id: item.id, ...item.attributes } : item;
    const szoTags = buildSzoSummaryFromItem(src);
    const docId =
      src.documentId ||
      src.guid ||
      src.VIOLATION_GUID_STR ||
      item.documentId ||
      item.guid ||
      item.VIOLATION_GUID_STR ||
      src.id;
    const resolvedGuid = extractGuid(item);
    const tsRaw = dayjs(getCreateDate(item)).valueOf();
    const ts = Number.isFinite(tsRaw) ? tsRaw : 0;
    const numKey = src?.number != null ? String(src.number) : null;
    const sendByGuid = resolvedGuid
      ? sendStatus.byGuid[String(resolvedGuid).toLowerCase()]
      : null;
    const send = sendByGuid || (numKey ? sendStatus.byNumber[numKey] : null);
    const durationClass = getDurationHighlightClass(item);

    return {
      key: src.id ?? item.id,
      guid: resolvedGuid,
      durationClass,
      number: src.number,
      energoObject: src.energoObject,
      addressList: src.addressList,
      dispCenter: src.dispCenter,
      createDateTime: ts ? dayjs(ts).format("DD.MM.YYYY HH:mm") : "—",
      createTs: ts,
      documentId: docId,
      szoTags,
      send,
      sendedEdds: (
        <Button
          disabled={src.sendedEdds}
          type="primary"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {src.sendedEdds ? "Отправлено" : "Отправить"}
        </Button>
      ),
    };
  });

  // 2) Отсортировать согласно текущему состояния сортировки (по умолчанию — дата/время, убыв.)
  const cmpStr = (a = "", b = "") => String(a).trim().localeCompare(String(b).trim(), "ru", { numeric: true, sensitivity: "base" });
  const sortedAll = [...rowsAll].sort((a, b) => {
    let res = 0;
    switch (sorter.field) {
      case "number":
        res = (Number(a.number) || 0) - (Number(b.number) || 0);
        break;
      case "energoObject":
        res = cmpStr(a.energoObject, b.energoObject);
        break;
      case "dispCenter":
        res = cmpStr(a.dispCenter, b.dispCenter);
        break;
      case "addressList":
        res = cmpStr(a.addressList, b.addressList);
        break;
      case "createDateTime":
      default:
        res = (a.createTs || 0) - (b.createTs || 0);
        break;
    }
    return sorter.order === "descend" ? -res : res;
  });

  // 3) Пагинация ПОСЛЕ сортировки
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const dataSource = sortedAll.slice(startIndex, startIndex + pagination.pageSize);

  const columns = [
    {
      title: "Номер",
      dataIndex: "number",
      key: "number",
      width: 120,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "number" ? sorter.order : null,
    },
    {
      title: "Объект",
      dataIndex: "energoObject",
      key: "energoObject",
      width: 220,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "energoObject" ? sorter.order : null,
    },
    {
      title: "Диспетчерская",
      dataIndex: "dispCenter",
      key: "dispCenter",
      width: 180,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "dispCenter" ? sorter.order : null,
    },
    {
      title: "Адрес",
      dataIndex: "addressList",
      key: "addressList",
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "addressList" ? sorter.order : null,
    },
    {
      title: "СЗО",
      dataIndex: "szoTags",
      key: "szo",
      width: 380,
      render: (tags) => <SzoCell tags={tags} />,
      ellipsis: true,
    },
    {
      title: "Отправки",
      dataIndex: "send",
      key: "send",
      width: 150,
      render: (st) => <SendDots st={st} />,
      ellipsis: true,
    },
    {
      title: "Дата/время возникновения",
      dataIndex: "createDateTime",
      key: "createDateTime",
      width: 180,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "createDateTime" ? sorter.order : null,
    },
  ];

  const paginationChange = (page, pageSize) => {
    setPagination({ page, pageSize });
  };

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        components: {
          Table: {
            rowHoverBg: "#ffb458ff",
          },
        },
      }}
    >
      <style>{`
        @keyframes tnNewBlink {
          0% { background: #f6ffed; }
          50% { background: #ffffff; }
          100% { background: #f6ffed; }
        }
        .tn-row-duration-orange > td { background: #fff7e6 !important; }
        .tn-row-duration-red > td { background: #fff1f0 !important; }
        .tn-row-new > td { animation: tnNewBlink 1.2s ease-in-out infinite; }
      `}</style>
      <audio
        ref={audioRef}
        src="/sound/sound.mp3"
        preload="auto"
        style={{ display: "none" }}
      />
      {/* Показываем всегда количество ОТКРЫТЫХ ТН (независимо от выбранных статусов), учитывая только фильтр по дате */}
      <WelcomeHeader totalOpened={openedCount} loadingOpened={loadingOpenedCount} />

      <TableTNActionsBar
      />

      {/* БЛОК ФИЛЬТРОВ */}
      <FiltersBar
        dateValue={date}
        onDateChange={(v) => {
          setDate(v);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        selectedStatuses={selectedStatuses}
        onStatusChange={handleStatusChange}
        searchNumber={searchNumber}
        onSearchNumberChange={(v) => {
          setSearchNumber(v);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        searchGuid={searchGuid}
        onSearchGuidChange={(v) => {
          setSearchGuid(v);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        rightExtra={
          <Flex gap={8} wrap justify="flex-end">
            <Button
              onClick={() => {
                setDate(null);
                setSelectedStatuses(["открыта"]);
                setPagination({ page: 1, pageSize: defaultPageSize });
              }}
            >
              Сброс
            </Button>
            <Tooltip title={sound ? "Звук включен" : "Звук выключен"}>
              <Button
                onClick={() => {
                  setSound((v) => !v);
                }}
                aria-label={sound ? "Выключить звук" : "Включить звук"}
              >
                {sound ? "🔔" : "🔕"}
              </Button>
            </Tooltip>
            {showJournal && (
              <Button onClick={() => setIsJournalOpen(true)}>
                Журнал отправки
              </Button>
            )}
            <Button
              disabled={isLoadingTns}
              onClick={() => {
                getTns({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
                loadOpenedCount({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
                loadSendStatus();
              }}
            >
              <ReloadOutlined />
            </Button>
          </Flex>
        }
      />

      {/* ТАБЛИЦА */}
      <Table
        rowClassName={(record) => {
          const classes = [];
          if (record?.durationClass) classes.push(record.durationClass);
          if (highlightGuids.has(record.guid)) classes.push("tn-row-new");
          return classes.join(" ");
        }}
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        onChange={(p, f, s) => {
          const info = Array.isArray(s) ? s[0] : s;
          if (info && info.field) {
            setSorter({ field: info.field, order: info.order || 'ascend' });
          } else {
            setSorter({ field: 'createDateTime', order: 'descend' });
          }
        }}
        onRow={(record) => {
          return {
            style: { cursor: "pointer" },
            onClick: () => {
              setIsOpenModalTN(record.documentId);
            },
          };
        }}
      />

      {/* ПАГИНАЦИЯ */}
      <div style={{ marginTop: 10 }}>
        <Pagination
          align="center"
          total={listFiltered.length}
          current={pagination.page}
          pageSize={pagination.pageSize}
          onChange={paginationChange}
          showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
        />
      </div>

      {/* МОДАЛКА С ТН */}
      <TNModal
        open={isOpenModalTN}
        onClose={() => {
          setIsOpenModalTN(false);
          setTimeout(() => {
            getTns({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
            loadOpenedCount({ date, excludeViolationType: EMERGENCY_VIOLATION_TYPE_EXCLUDE });
            loadSendStatus();
          }, 0);
        }}
        documentId={isOpenModalTN}
      />

      <JournalOpenModal
        open={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
      />
    </ConfigProvider>
  );
}
