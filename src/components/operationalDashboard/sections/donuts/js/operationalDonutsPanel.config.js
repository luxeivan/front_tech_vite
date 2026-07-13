export const DURATION_DONUT_CONFIG = {
  title: "Количество аварийных отключений ЛЭП 3–20кВ",
  centerLabel: "всего",
  segments: [
    {
      key: "under2h",
      label: "до 2 часов",
      color: "#8ad34a",
    },
    {
      key: "over2h",
      label: "более 2 часов",
      color: "#ffc928",
    },
    {
      key: "over4h",
      label: "более 4 часов",
      color: "#ff171f",
    },
  ],
};

export const POPULATION_DONUT_CONFIG = {
  title: "Обесточено населения",
  centerLabel: "чел.",
  segments: [
    {
      key: "under5000",
      label: "до 5000 чел.",
      color: "#8ad34a",
    },
    {
      key: "from5000to20000",
      label: "от 5000 до 20000 чел.",
      color: "#ffc928",
    },
    {
      key: "over20000",
      label: "более 20000 чел.",
      color: "#ff171f",
    },
  ],
};
