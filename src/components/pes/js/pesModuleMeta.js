// Справочник статусов ПЭС для UI.
export const STATUS_META = {
  ready: { label: "Готова к выезду (в резерве)" },
  command_sent: { label: "Дана команда на выезд" },
  delay: { label: "Задержка выезда" },
  en_route: { label: "В пути" },
  connected: { label: "Подключена (в работе)" },
  repair: { label: "В ремонте" },
};

// Текстовые метаданные операций.
export function getActionMeta(action) {
  if (action === "dispatch")
    return { title: "Команда на выезд", description: "Команда успешно отправлена по выбранным ПЭС." };
  if (action === "reroute")
    return { title: "Корректировка маршрута", description: "Точка назначения обновлена." };
  if (action === "cancel")
    return { title: "Отмена выезда", description: "Команда на выезд отменена, ПЭС возвращены в резерв." };
  if (action === "depart")
    return { title: "Фактический выезд", description: "ПЭС переведены в статус 'В пути'." };
  if (action === "connect")
    return { title: "Подключена", description: "ПЭС переведены в статус 'Подключена'." };
  if (action === "ready")
    return { title: "Возврат в резерв", description: "ПЭС переведены в статус 'Готова к выезду'." };
  if (action === "repair")
    return { title: "Статус ремонта", description: "ПЭС переведены в статус 'В ремонте'." };
  return { title: "Операция", description: "Операция выполнена." };
}

// Человекочитаемая подпись статуса.
export function statusLabel(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/,+$/, "");
  return STATUS_META[normalized]?.label || status || "—";
}

// Форматирование даты/времени для журнала.
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU");
}

// Форматирование мощности для плиток/подсказок.
export function formatPowerKw(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

// Агрегация счетчиков по статусам.
export function calcSummary(items) {
  const s = {
    total: items.length,
    ready: 0,
    commandSent: 0,
    delay: 0,
    enRoute: 0,
    connected: 0,
    repair: 0,
  };

  items.forEach((x) => {
    if (x.effectiveStatus === "ready") s.ready += 1;
    else if (x.effectiveStatus === "command_sent") s.commandSent += 1;
    else if (x.effectiveStatus === "delay") s.delay += 1;
    else if (x.effectiveStatus === "en_route") s.enRoute += 1;
    else if (x.effectiveStatus === "connected") s.connected += 1;
    else if (x.effectiveStatus === "repair") s.repair += 1;
  });

  return s;
}
