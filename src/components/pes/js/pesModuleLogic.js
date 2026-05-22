import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { notification } from "antd";
import useAuth from "../../../stores/useAuth";
import usePesDestinationsStore from "../../../stores/pes/usePesDestinationsStore";
import usePesModuleDataStore from "../../../stores/pes/usePesModuleDataStore";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";
import { buildAuditHeaders } from "../../../utils/auditLogger";
import { calcSummary, getActionMeta, statusLabel } from "./pesModuleMeta";

const PES_LIVE_POLL_MS = 10000;

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

function ruSort(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ru");
}

function makeScopedPoValue(branch, po) {
  return `${String(branch || "").trim()}|||${String(po || "").trim()}`;
}

function parseScopedPoValue(value) {
  const raw = String(value || "");
  const i = raw.indexOf("|||");
  if (i < 0) return null;
  return {
    branch: raw.slice(0, i),
    po: raw.slice(i + 3),
  };
}

export default function pesModuleLogic() {
  const user = useAuth((s) => s.user);
  const liveSnapshotRef = useRef(new Map());
  const liveReadyRef = useRef(false);

  // UI: выбранные плитки.
  const [selected, setSelected] = useState([]);
  // UI: фильтры витрины.
  const [branchFilter, setBranchFilter] = useState("__all__");
  const [poFilter, setPoFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  // UI: комментарий и состояние отправки.
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // UI: каскадные фильтры для поиска ТП.
  const [tpBranchFilter, setTpBranchFilter] = useState("__all__");
  const [tpPoFilter, setTpPoFilter] = useState("__all__");

  const canManage = hasFeatureAccess(user?.view_role, "pesManage");
  const mode = selected.length > 1 ? "multi" : "single";

  // Store: данные ПЭС/истории.
  const {
    loading,
    items,
    error,
    config,
    loadConfig,
    loadItems,
    historyLoading,
    historyItems,
    historyPage,
    historyPageSize,
    historyTotal,
    loadHistory,
    applyUpdated,
  } = usePesModuleDataStore();

  // Store: точки назначения.
  const {
    destinations,
    tpHints,
    destinationType,
    setDestinationType,
    destinationId,
    setDestinationId,
    loadingDestinations,
    loadDestinations,
  } = usePesDestinationsStore();

  const destinationBranch = useMemo(() => {
    if (destinationType === "assembly") return "";
    if (mode === "multi") return "";

    if (destinationType === "tp") {
      if (tpBranchFilter !== "__all__") return tpBranchFilter;
      return "";
    }

    return "";
  }, [mode, destinationType, tpBranchFilter]);

  const destinationOptions = useMemo(() => {
    const source =
      destinationType === "tp"
        ? destinations.tp.filter((x) => {
            if (tpBranchFilter !== "__all__" && x.branch !== tpBranchFilter) return false;
            return true;
          })
        : destinations.assembly;
    return source.map((x) => {
      const showBranch = tpBranchFilter === "__all__";
      const showPo = tpPoFilter === "__all__";
      const branchPo = [
        showBranch ? x.branch : "",
        showPo ? x.po : "",
      ]
        .filter(Boolean)
        .join(" / ");
      const prefix = destinationType === "tp" && branchPo ? `[${branchPo}] ` : "";
      return { label: `${prefix}${x.title} — ${x.address}`, value: x.id };
    });
  }, [destinations, destinationType, tpBranchFilter, tpPoFilter]);

  // Опции филиалов для каскадного выбора ТП: отдельный "легкий" справочник.
  const tpBranchOptions = useMemo(() => {
    const values = Array.from(new Set((tpHints || []).map((x) => x.branch).filter(Boolean))).sort(ruSort);
    return [{ label: "Все филиалы", value: "__all__" }, ...values.map((x) => ({ label: x, value: x }))];
  }, [tpHints]);

  // Опции ПО для каскадного выбора ТП (зависят от выбранного филиала).
  const tpPoOptions = useMemo(() => {
    if (tpBranchFilter !== "__all__") {
      const row = (tpHints || []).find((x) => x.branch === tpBranchFilter);
      const values = Array.from(new Set((row?.po || []).filter(Boolean))).sort(ruSort);
      return [
        { label: "Все ПО", value: "__all__" },
        ...values.map((po) => ({
          label: po,
          value: makeScopedPoValue(tpBranchFilter, po),
        })),
      ];
    }

    const groups = Array.from(tpHints || [])
      .filter((x) => x?.branch)
      .sort((a, b) => ruSort(a.branch, b.branch))
      .map((row) => ({
        label: row.branch,
        options: Array.from(new Set((row?.po || []).filter(Boolean)))
          .sort(ruSort)
          .map((po) => ({
            label: po,
            value: makeScopedPoValue(row.branch, po),
          })),
      }));

    return [{ label: "Все ПО", value: "__all__" }, ...groups];
  }, [tpHints, tpBranchFilter]);

  const showHistoryError = useCallback((e) => {
    notification.error({
      message: "Не удалось загрузить историю",
      description: e?.response?.data?.message || e?.message || "Ошибка чтения истории операций ПЭС.",
      placement: "topRight",
    });
  }, []);

  const refreshHistory = useCallback(async ({ nextPage, nextPageSize } = {}) => {
    const err = await loadHistory({
      nextPage,
      nextPageSize,
      branchFilter,
      poFilter,
      user,
    });
    if (err) showHistoryError(err);
  }, [branchFilter, loadHistory, poFilter, showHistoryError, user]);

  useEffect(() => {
    loadItems(user);
    loadConfig();
  }, [user, loadItems, loadConfig]);

  useEffect(() => {
    if (!items.length) return;
    if (!liveReadyRef.current || sending) {
      liveSnapshotRef.current = new Map(
        items.map((item) => [
          item.id,
          {
            status: item.effectiveStatus,
            commandSentAt: item.commandSentAt,
            actualDepartureAt: item.actualDepartureAt,
            connectedAt: item.connectedAt,
            destinationId: item.destination?.id || "",
          },
        ])
      );
      liveReadyRef.current = true;
    }
  }, [items, sending]);

  useEffect(() => {
    if (!user) return undefined;

    const buildSnapshot = (rows) =>
      new Map(
        rows.map((item) => [
          item.id,
          {
            status: item.effectiveStatus,
            commandSentAt: item.commandSentAt,
            actualDepartureAt: item.actualDepartureAt,
            connectedAt: item.connectedAt,
            destinationId: item.destination?.id || "",
            number: item.number,
          },
        ])
      );

    const findChanges = (prev, rows) => {
      const changes = [];
      for (const item of rows) {
        const before = prev.get(item.id);
        if (!before) continue;
        const afterStatus = item.effectiveStatus;
        const statusChanged = before.status !== afterStatus;
        const dateChanged =
          before.commandSentAt !== item.commandSentAt ||
          before.actualDepartureAt !== item.actualDepartureAt ||
          before.connectedAt !== item.connectedAt ||
          before.destinationId !== (item.destination?.id || "");

        if (statusChanged || dateChanged) {
          changes.push({
            number: item.number,
            from: statusLabel(before.status),
            to: statusLabel(afterStatus),
          });
        }
      }
      return changes;
    };

    const poll = async () => {
      if (sending || loading || document.hidden) return;

      const rows = await loadItems(user, { silent: true });
      if (!Array.isArray(rows)) return;

      if (!liveReadyRef.current) {
        liveSnapshotRef.current = buildSnapshot(rows);
        liveReadyRef.current = true;
        return;
      }

      const changes = findChanges(liveSnapshotRef.current, rows);
      liveSnapshotRef.current = buildSnapshot(rows);

      if (!changes.length) return;

      const first = changes[0];
      notification.info({
        message: "Статус ПЭС обновился",
        description:
          changes.length === 1
            ? `ПЭС №${first.number}: ${first.from} → ${first.to}`
            : `Обновлено ПЭС: ${changes.length}. Например №${first.number}: ${first.from} → ${first.to}`,
        placement: "topRight",
        duration: 5,
      });

      if (historyOpen) {
        refreshHistory({ nextPage: 1, nextPageSize: historyPageSize });
      }
    };

    const timer = window.setInterval(poll, PES_LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [user, sending, loading, loadItems, historyOpen, historyPageSize, refreshHistory]);

  useEffect(() => {
    const scopedPo = parseScopedPoValue(tpPoFilter);
    let requestBranch = destinationBranch;
    let requestPo = "";

    if (destinationType === "tp") {
      if (tpPoFilter !== "__all__" && scopedPo?.branch && scopedPo?.po) {
        requestBranch = scopedPo.branch;
        requestPo = scopedPo.po;
      } else {
        requestBranch = "";
      }
    }

    loadDestinations(mode, requestBranch, destinationType, requestPo);
  }, [mode, destinationBranch, destinationType, tpBranchFilter, tpPoFilter, loadDestinations]);

  // Валидируем каскадные фильтры ТП при обновлении справочника.
  useEffect(() => {
    const branchSet = new Set((tpBranchOptions || []).map((x) => x.value).filter((x) => x !== "__all__"));
    if (tpBranchFilter !== "__all__" && !branchSet.has(tpBranchFilter)) {
      setTpBranchFilter("__all__");
      setTpPoFilter("__all__");
      return;
    }

    const flatten = [];
    for (const opt of tpPoOptions || []) {
      if (Array.isArray(opt?.options)) flatten.push(...opt.options);
      else flatten.push(opt);
    }
    const poSet = new Set(flatten.map((x) => x?.value).filter((x) => x && x !== "__all__"));
    if (tpPoFilter !== "__all__" && !poSet.has(tpPoFilter)) {
      setTpPoFilter("__all__");
    }
  }, [tpBranchOptions, tpPoOptions, tpBranchFilter, tpPoFilter]);

  useEffect(() => {
    if (!historyOpen) return;
    refreshHistory({ nextPage: 1, nextPageSize: historyPageSize });
  }, [historyOpen, historyPageSize, branchFilter, poFilter, refreshHistory]);

  const branchOptions = useMemo(
    () => [
      { label: "Все филиалы", value: "__all__" },
      ...Array.from(new Set(items.map((x) => x.branch).filter(Boolean))).map((x) => ({ label: x, value: x })),
    ],
    [items]
  );

  const poOptions = useMemo(() => {
    // В рамках конкретного филиала оставляем плоский список ПО.
    if (branchFilter && branchFilter !== "__all__") {
      const values = Array.from(
        new Set(items.filter((x) => x.branch === branchFilter).map((x) => x.po).filter(Boolean))
      ).sort(ruSort);
      return [
        { label: "Все ПО", value: "__all__" },
        ...values.map((po) => ({
          label: po,
          value: makeScopedPoValue(branchFilter, po),
        })),
      ];
    }

    // При "Все филиалы" группируем ПО по филиалам.
    const byBranch = new Map();
    for (const row of items) {
      const branch = String(row?.branch || "").trim();
      const po = String(row?.po || "").trim();
      if (!branch || !po) continue;
      if (!byBranch.has(branch)) byBranch.set(branch, new Set());
      byBranch.get(branch).add(po);
    }

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

    return [{ label: "Все ПО", value: "__all__" }, ...groups];
  }, [items, branchFilter]);

  const filteredItems = useMemo(
    () =>
      items.filter((x) => {
        if (branchFilter !== "__all__" && x.branch !== branchFilter) return false;
        if (poFilter !== "__all__") {
          const scoped = parseScopedPoValue(poFilter);
          if (scoped) {
            if (x.branch !== scoped.branch || x.po !== scoped.po) return false;
          } else if (x.po !== poFilter) {
            return false;
          }
        }
        if (statusFilter !== "__all__" && x.effectiveStatus !== statusFilter) return false;
        return true;
      }),
    [items, branchFilter, poFilter, statusFilter]
  );

  const filteredSummary = useMemo(() => calcSummary(filteredItems), [filteredItems]);

  useEffect(() => {
    const allowed = new Set(filteredItems.map((x) => x.id));
    setSelected((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredItems]);

  const selectedItems = useMemo(() => items.filter((x) => selected.includes(x.id)), [items, selected]);

  const isAllowedTransition = (action, item) => {
    const st = item?.effectiveStatus;
    if (action === "dispatch") return st === "ready";
    if (action === "reroute") return ["command_sent", "delay", "en_route"].includes(st);
    if (action === "cancel") return ["command_sent", "delay", "en_route"].includes(st);
    if (action === "depart") return ["command_sent", "delay"].includes(st);
    if (action === "connect") return st === "en_route";
    if (action === "ready") return ["connected", "repair"].includes(st);
    if (action === "repair") return st !== "repair";
    return true;
  };

  const actionState = (action) => {
    if (!canManage) return { disabled: true, reason: "Режим просмотра" };
    if (!selectedItems.length) return { disabled: true, reason: "Сначала отметьте хотя бы одну ПЭС" };
    if (["dispatch", "reroute"].includes(action) && loadingDestinations) {
      return { disabled: true, reason: "Дождитесь загрузки точек назначения" };
    }
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
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

    if (["dispatch", "reroute"].includes(action) && !destinationOptions.some((x) => x.value === destinationId)) {
      notification.warning({
        message: "Точка назначения устарела",
        description: "Список точек обновился. Выберите точку назначения заново.",
        placement: "topRight",
      });
      const scopedPo = parseScopedPoValue(tpPoFilter);
      const destinationPo =
        destinationType === "tp" && tpBranchFilter !== "__all__" && tpPoFilter !== "__all__"
          ? scopedPo?.po || tpPoFilter
          : "";
      await loadDestinations(mode, destinationBranch, destinationType, destinationPo);
      return;
    }

    try {
      setSending(true);
      const base = getBackendBase();
      const safeDestinationType = mode === "multi" ? "assembly" : destinationType;
      const payload = {
        action,
        pesIds: selected,
        destinationType: safeDestinationType,
        destinationId,
        comment,
      };
      if (action === "depart") payload.actualDepartureAt = new Date().toISOString();

      const { data } = await axios.post(`${base}/services/pes/module/command`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          "x-view-role": user?.view_role || "",
          ...buildAuditHeaders(user, "/pes"),
        },
      });

      const meta = getActionMeta(action);
      if (data?.max?.skipped || data?.max?.ok === false) {
        notification.warning({
          message: `${meta.title}: выполнено частично`,
          description: `Операция применена, но MAX пропущен: ${data?.max?.reason || "не настроен"}.`,
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
      applyUpdated(data?.updated);
      await loadItems(user);
      if (historyOpen) await refreshHistory({ nextPage: 1, nextPageSize: historyPageSize });
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

  return {
    canManage,
    mode,

    loading,
    items,
    error,
    config,
    loadItems: () => loadItems(user),

    historyLoading,
    historyItems,
    historyPage,
    historyPageSize,
    historyTotal,
    refreshHistory,

    selected,
    toggleSelected,

    destinationType,
    setDestinationType,
    destinationId,
    setDestinationId,
    loadingDestinations,
    destinationOptions,
    tpBranchFilter,
    setTpBranchFilter,
    tpPoFilter,
    setTpPoFilter,
    tpBranchOptions,
    tpPoOptions,

    comment,
    setComment,
    sending,
    actionState,
    runAction,

    branchFilter,
    setBranchFilter,
    poFilter,
    setPoFilter,
    statusFilter,
    setStatusFilter,
    resetFilters,
    branchOptions,
    poOptions,
    filteredItems,
    filteredSummary,

    historyOpen,
    setHistoryOpen,
  };
}
