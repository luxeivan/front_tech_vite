import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Card, Empty } from "antd";
import PlannedSunStub from "../../components/planned/jsx/PlannedSunStub";
import pesModuleLogic from "../../components/pes/js/pesModuleLogic"; // Оркестрация UI-логики модуля ПЭС.
import { STATUS_META } from "../../components/pes/js/pesModuleMeta"; // Справочник статусов для фильтра и подписей.
import PesTilesBoard from "../../components/pes/jsx/PesTilesBoard"; // Плиточная доска всех ПЭС.
import PesHeader from "../../components/pes/jsx/PesHeader"; // Верхняя панель: заголовок, режим, счетчики, действия.
import PesCommandCard from "../../components/pes/jsx/PesCommandCard"; // Карточка команд: выбор назначения, комментарий, кнопки операций.
import PesFiltersCard from "../../components/pes/jsx/PesFiltersCard"; // Карточка фильтров: филиал, ПО, статус.
import PesHistoryDrawer from "../../components/pes/jsx/PesHistoryDrawer"; // Выдвижной журнал истории операций ПЭС.

import "../../components/pes/css/PesModule.css";

// Временная заглушка модуля ПЭС. Чтобы вернуть рабочий модуль, поставь false.
const SHOW_PES_STUB = false;

export default function PesPage() {
  if (SHOW_PES_STUB) {
    return <PlannedSunStub />;
  }

  const [easterActive, setEasterActive] = useState(false);
  const secretIndexRef = useRef(0);
  const easterTimerRef = useRef(null);

  const SECRET_SEQUENCE = useMemo(
    () => [
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      ..."мособлэнерго".split(""),
    ],
    []
  );

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

  useEffect(() => {
    const normalizeKey = (rawKey) => {
      const key = String(rawKey || "").toLowerCase();
      if (key === "arrowup") return "arrowup";
      if (key === "arrowdown") return "arrowdown";
      if (key === "arrowleft") return "arrowleft";
      if (key === "arrowright") return "arrowright";
      if (key.length === 1) return key;
      return "";
    };

    const onKeyDown = (e) => {
      const token = normalizeKey(e.key);
      if (!token) return;

      const nextExpected = SECRET_SEQUENCE[secretIndexRef.current];
      if (token === nextExpected) {
        secretIndexRef.current += 1;
        if (secretIndexRef.current >= SECRET_SEQUENCE.length) {
          secretIndexRef.current = 0;
          setEasterActive(true);
          if (easterTimerRef.current) clearTimeout(easterTimerRef.current);
          easterTimerRef.current = setTimeout(() => setEasterActive(false), 10000);
        }
        return;
      }

      secretIndexRef.current = token === SECRET_SEQUENCE[0] ? 1 : 0;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (easterTimerRef.current) clearTimeout(easterTimerRef.current);
    };
  }, [SECRET_SEQUENCE]);

  return (
    <div className={`pes-module${easterActive ? " pes-module--easter" : ""}`}>
      <PesHeader
        canManage={canManage}
        loading={loading}
        filteredSummary={filteredSummary}
        onRefresh={loadItems}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {error && <Alert type="error" showIcon style={{ marginBottom: 8 }} message={error} />}

      {/* {config && !config.maxConfigured && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="MAX-уведомления пока не настроены (работаем в режиме подготовки)."
        />
      )} */}

      {!canManage && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          message="Режим наблюдателя"
        />
      )}

      {easterActive && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 8 }}
          message="Корги устроили аварийные учения: хаос-режим на 10 секунд."
        />
      )}

      {easterActive && (
        <div className="pes-easter-corgi-layer" aria-hidden="true">
          <span className="pes-easter-corgi pes-easter-corgi--1">🐶</span>
          <span className="pes-easter-corgi pes-easter-corgi--2">🐕</span>
          <span className="pes-easter-corgi pes-easter-corgi--3">🐶</span>
          <span className="pes-easter-corgi pes-easter-corgi--4">🐕</span>
          <span className="pes-easter-corgi pes-easter-corgi--5">🐶</span>
          <span className="pes-easter-corgi pes-easter-corgi--6">🐕</span>
        </div>
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
          loadingDestinations={loadingDestinations}
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
