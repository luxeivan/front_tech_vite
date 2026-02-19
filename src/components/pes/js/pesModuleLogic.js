import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { notification } from "antd";
import useAuth from "../../../stores/useAuth";
import usePesDestinationsStore from "../../../stores/pes/usePesDestinationsStore";
import usePesModuleDataStore from "../../../stores/pes/usePesModuleDataStore";
import { buildAuditHeaders, logAuditEvent } from "../../../utils/auditLogger";
import { calcSummary, getActionMeta } from "./pesModuleMeta";

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

export default function pesModuleLogic() {
  const user = useAuth((s) => s.user);

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

  const canManage = user?.view_role === "standart";
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
  } = usePesModuleDataStore();

  // Store: точки назначения.
  const {
    destinations,
    destinationType,
    setDestinationType,
    destinationId,
    setDestinationId,
    loadDestinations,
  } = usePesDestinationsStore();

  const destinationBranch = useMemo(() => {
    // Для массовых операций всегда разрешаем точки всех филиалов.
    // Это нужно для сценария, когда ПЭС из разных филиалов отправляют
    // на точку сбора проблемного филиала.
    if (mode === "multi") return "";

    if (selected.length === 1) {
      const item = items.find((x) => x.id === selected[0]);
      if (item?.branch) return item.branch;
    }
    if (branchFilter !== "__all__") return branchFilter;
    return "";
  }, [selected, items, branchFilter]);

  const destinationOptions = useMemo(() => {
    const source = destinationType === "tp" ? destinations.tp : destinations.assembly;
    return source.map((x) => {
      const branchPo = [x.branch, x.po].filter(Boolean).join(" / ");
      const prefix = branchPo ? `[${branchPo}] ` : "";
      return { label: `${prefix}${x.title} — ${x.address}`, value: x.id };
    });
  }, [destinations, destinationType]);

  const showHistoryError = (e) => {
    notification.error({
      message: "Не удалось загрузить историю",
      description: e?.response?.data?.message || e?.message || "Ошибка чтения истории операций ПЭС.",
      placement: "topRight",
    });
  };

  const refreshHistory = async ({ nextPage, nextPageSize } = {}) => {
    const err = await loadHistory({
      nextPage,
      nextPageSize,
      branchFilter,
      poFilter,
      user,
    });
    if (err) showHistoryError(err);
  };

  useEffect(() => {
    loadItems(user);
    loadConfig();
  }, [user, loadItems, loadConfig]);

  useEffect(() => {
    loadDestinations(mode, destinationBranch);
  }, [mode, destinationBranch, loadDestinations]);

  useEffect(() => {
    if (!historyOpen) return;
    refreshHistory({ nextPage: 1, nextPageSize: historyPageSize });
  }, [historyOpen, historyPageSize, branchFilter, poFilter]);

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

  const filteredItems = useMemo(
    () =>
      items.filter((x) => {
        if (branchFilter !== "__all__" && x.branch !== branchFilter) return false;
        if (poFilter !== "__all__" && x.po !== poFilter) return false;
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
      await loadDestinations(mode, destinationBranch);
      return;
    }

    try {
      setSending(true);
      const base = getBackendBase();
      const payload = { action, pesIds: selected, destinationType, destinationId, comment };
      if (action === "depart") payload.actualDepartureAt = new Date().toISOString();

      const { data } = await axios.post(`${base}/services/pes/module/command`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          "x-view-role": user?.view_role || "",
          ...buildAuditHeaders(user, "/pes"),
        },
      });

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
          details: { destinationType, destinationId },
        },
        user
      );

      setComment("");
      setSelected([]);
      setDestinationId(undefined);
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
    destinationOptions,

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
