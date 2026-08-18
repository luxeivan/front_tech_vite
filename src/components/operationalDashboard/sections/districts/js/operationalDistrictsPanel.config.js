import { createElement } from "react";

export const OPERATIONAL_BRANCHES = [
  "Домодедовский",
  "Коломенский",
  "Красногорский",
  "Мытищинский",
  "Одинцовский",
  "Орехово-Зуевский",
  "Павлово-Посадский",
  "Раменский",
  "Сергиево-Посадский",
  "Щёлковский",
];

export const OPERATIONAL_DISPCENTER_TO_BRANCH = {
  Видное: "Домодедовский",
  Домодедово: "Домодедовский",
  Подольск: "Домодедовский",
  Чехов: "Домодедовский",

  Гжель: "Раменский",
  Ильинское: "Раменский",
  Люберцы: "Раменский",
  Раменское: "Раменский",

  Воскресенск: "Коломенский",
  Кашира: "Коломенский",
  Коломна: "Коломенский",
  Луховицы: "Коломенский",
  Протвино: "Коломенский",
  Серпухов: "Коломенский",
  Ступино: "Коломенский",

  Истра: "Красногорский",
  Клин: "Красногорский",
  Красногорск: "Красногорский",
  Химки: "Красногорский",

  "Орехово-Зуево город": "Орехово-Зуевский",

  Егорьевск: "Павлово-Посадский",
  "Орехово-Зуево район": "Павлово-Посадский",
  Рошаль: "Павлово-Посадский",
  Шатура: "Павлово-Посадский",
  Электросталь: "Павлово-Посадский",

  Голицыно: "Одинцовский",
  Звенигород: "Одинцовский",
  Краснознаменск: "Одинцовский",
  "Наро-Фоминск": "Одинцовский",
  Одинцово: "Одинцовский",
  Руза: "Одинцовский",

  Мытищи: "Мытищинский",
  Пушкино: "Мытищинский",

  Балашиха: "Щёлковский",
  "Лосино-Петровский": "Щёлковский",
  Ногинск: "Щёлковский",
  Фрязино: "Щёлковский",
  Щелково: "Щёлковский",

  Дубна: "Сергиево-Посадский",
  "Сергиев-Посад": "Сергиево-Посадский",
};

export const OPERATIONAL_BRANCH_UNKNOWN_VALUE = "?";

const nowrapHeader = {
  onHeaderCell: () => ({
    className: "operational-districts-panel__header-cell--nowrap",
  }),
};

const compactHeader = {
  onHeaderCell: () => ({
    className: "operational-districts-panel__header-cell--compact",
  }),
};

const compactTitle = (title) =>
  createElement(
    "span",
    { className: "operational-districts-panel__header-title--compact" },
    title
  );

const twoLineTitle = (firstLine, secondLine) =>
  createElement(
    "span",
    { className: "operational-districts-panel__header-title--two-line" },
    createElement("span", null, firstLine),
    createElement("span", null, secondLine)
  );

const stackedTitle = (...lines) =>
  createElement(
    "span",
    { className: "operational-districts-panel__header-title--stacked" },
    ...lines.map((line) => createElement("span", { key: line }, line))
  );

export const OPERATIONAL_BRANCH_COLUMNS = [
  {
    title: "Филиал",
    dataIndex: "branch",
    width: 142,
    onCell: () => ({
      className: "operational-districts-panel__branch-cell",
    }),
  },
  { title: "ЛЭП", dataIndex: "lep", width: 46, ...nowrapHeader },
  { title: "ТП (РП)", dataIndex: "tpRp", width: 54 },
  { title: compactTitle("Население"), dataIndex: "population", width: 66, ...compactHeader },
  { title: compactTitle("МКД"), dataIndex: "mkd", width: 46, ...compactHeader },
  { title: "Котел. ЦТП", dataIndex: "boilerCtp", width: 62 },
  { title: "ВЗУ ВНС", dataIndex: "vzuVns", width: 58 },
  { title: "КНС", dataIndex: "kns", width: 44, ...nowrapHeader },
  {
    title: stackedTitle("Больницы", "Поликлини", "ки"),
    dataIndex: "medical",
    width: 78,
  },
  { title: twoLineTitle("Школы", "д.сады"), dataIndex: "schools", width: 72 },
  { title: compactTitle("Бригады"), dataIndex: "brigades", width: 54, ...compactHeader },
  { title: compactTitle("Персонал"), dataIndex: "staff", width: 58, ...compactHeader },
  { title: compactTitle("Техника"), dataIndex: "vehicles", width: 54, ...compactHeader },
  { title: "ПЭС", dataIndex: "pes", width: 44, ...nowrapHeader },
  { title: "Осн. ресурс", dataIndex: "mainResource", width: 62 },
  { title: "ОВБ", dataIndex: "ovb", width: 44, ...nowrapHeader },
];
