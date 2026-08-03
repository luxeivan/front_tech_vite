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
  "Щелковский",
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

  Балашиха: "Щелковский",
  "Лосино-Петровский": "Щелковский",
  Ногинск: "Щелковский",
  Фрязино: "Щелковский",
  Щелково: "Щелковский",

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

export const OPERATIONAL_BRANCH_COLUMNS = [
  {
    title: "Филиал",
    dataIndex: "branch",
    width: 132,
    onCell: () => ({
      className: "operational-districts-panel__branch-cell",
    }),
  },
  { title: "ЛЭП", dataIndex: "lep", width: 42, ...nowrapHeader },
  { title: "ТП (РП)", dataIndex: "tpRp", width: 50 },
  { title: compactTitle("Население"), dataIndex: "population", width: 60, ...compactHeader },
  { title: "МКД", dataIndex: "mkd", width: 42, ...nowrapHeader },
  { title: "Котел. ЦТП", dataIndex: "boilerCtp", width: 58 },
  { title: "ВЗУ ВНС", dataIndex: "vzuVns", width: 54 },
  { title: "КНС", dataIndex: "kns", width: 40, ...nowrapHeader },
  { title: "Больницы Поликлиники", dataIndex: "medical", width: 74 },
  { title: "Школы д. сады", dataIndex: "schools", width: 68 },
  { title: compactTitle("Бригады"), dataIndex: "brigades", width: 50, ...compactHeader },
  { title: compactTitle("Персонал"), dataIndex: "staff", width: 54, ...compactHeader },
  { title: compactTitle("Техника"), dataIndex: "vehicles", width: 50, ...compactHeader },
  { title: "ПЭС", dataIndex: "pes", width: 40, ...nowrapHeader },
  { title: "Осн. ресурс", dataIndex: "mainResource", width: 58 },
  { title: "ОВБ", dataIndex: "ovb", width: 40, ...nowrapHeader },
];
