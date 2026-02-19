import React, { useMemo } from "react";
import { Alert, Card, Empty } from "antd";
import { useNavigate } from "react-router-dom";
import pesModuleLogic from "../js/pesModuleLogic"; // Оркестрация UI-логики модуля ПЭС.
import { STATUS_META } from "../js/pesModuleMeta"; // Справочник статусов для фильтра и подписей.
import PesTilesBoard from "./PesTilesBoard"; // Плиточная доска всех ПЭС.
import PesHeader from "./PesHeader"; // Верхняя панель: заголовок, режим, счетчики, действия.
import PesCommandCard from "./PesCommandCard"; // Карточка команд: выбор назначения, комментарий, кнопки операций.
import PesFiltersCard from "./PesFiltersCard"; // Карточка фильтров: филиал, ПО, статус.
import PesHistoryDrawer from "./PesHistoryDrawer"; // Выдвижной журнал истории операций ПЭС.

import "../css/PesModule.css";

export default function PesModule() {
  const navigate = useNavigate();

  const {
    canManage,
    mode,
    loading,
    error,
    config,
    loadItems,

    historyLoading,
    historyItems,
    historyPage,
    historyPageSize,
    historyTotal,
    refreshHistory,

    selected,
    destinationType,
    setDestinationType,
    destinationId,
    setDestinationId,
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
    toggleSelected,

    historyOpen,
    setHistoryOpen,
  } = pesModuleLogic();

  const statusOptions = useMemo(
    () => [
      { label: "Все статусы", value: "__all__" },
      ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
    ],
    []
  );

  return (
    <div className="pes-module">
      <PesHeader
        canManage={canManage}
        loading={loading}
        filteredSummary={filteredSummary}
        onBack={() => navigate("/")}
        onRefresh={loadItems}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {error && <Alert type="error" showIcon style={{ marginBottom: 8 }} message={error} />}

      {/* {config && !config.telegramConfigured && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="Telegram-уведомления пока не настроены (работаем в режиме подготовки)."
        />
      )} */}

      {!canManage && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message="Режим наблюдателя: можно смотреть, но управлять ПЭС нельзя 🙂"
        />
      )}

      {canManage ? (
        <PesCommandCard
          mode={mode}
          selectedCount={selected.length}
          sending={sending}
          destinationType={destinationType}
          setDestinationType={setDestinationType}
          destinationId={destinationId}
          setDestinationId={setDestinationId}
          destinationOptions={destinationOptions}
          tpBranchFilter={tpBranchFilter}
          setTpBranchFilter={setTpBranchFilter}
          tpPoFilter={tpPoFilter}
          setTpPoFilter={setTpPoFilter}
          tpBranchOptions={tpBranchOptions}
          tpPoOptions={tpPoOptions}
          comment={comment}
          setComment={setComment}
          actionState={actionState}
          runAction={runAction}
        />
      ) : null}

      <PesFiltersCard
        branchOptions={branchOptions}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        poOptions={poOptions}
        poFilter={poFilter}
        setPoFilter={setPoFilter}
        statusOptions={statusOptions}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        resetFilters={resetFilters}
      />

      {filteredItems.length === 0 ? (
        <Card>
          <Empty description="По текущим фильтрам ПЭС не найдены" />
        </Card>
      ) : (
        <PesTilesBoard
          items={filteredItems}
          selected={selected}
          onToggle={toggleSelected}
          selectable={canManage && !sending}
        />
      )}

      <PesHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyLoading={historyLoading}
        historyItems={historyItems}
        historyPage={historyPage}
        historyPageSize={historyPageSize}
        historyTotal={historyTotal}
        onRefresh={refreshHistory}
        onPageChange={(nextPage, nextPageSize) => refreshHistory({ nextPage, nextPageSize })}
      />
    </div>
  );
}
