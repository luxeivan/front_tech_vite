import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import OperationalNavigationSteps from "../../components/operationalDashboard/jsx/OperationalNavigationSteps";
import OperationalMapPanel, {
  OperationalMapTopline,
} from "../../components/operationalDashboard/sections/map/jsx/OperationalMapPanel";
import OperationalDonutsPanel from "../../components/operationalDashboard/sections/donuts/jsx/OperationalDonutsPanel";
import OperationalDistrictsPanel from "../../components/operationalDashboard/sections/districts/jsx/OperationalDistrictsPanel";
import OperationalChartsPanel from "../../components/operationalDashboard/sections/charts/jsx/OperationalChartsPanel";
import BrandSunLoader from "../../components/ui/BrandSunLoader";
import {
  isDashboardBaseType,
  isNotDeletedTN,
  isOpenTN,
  pick,
  toNumber,
} from "../../components/dashboard/js/dashboardCommon";
import {
  getOperationalBranchByRow,
  getOperationalDistrictByRow,
  getOperationalPoByRow,
  normalizeDistrictLookupName,
  normalizeLookupName,
} from "../../components/operationalDashboard/sections/districts/js/operationalDistrictsPanel.utils";
import useOperationalDashboardStore from "../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  getOperationalFilialRouteBySlug,
  getOperationalPoSlug,
} from "../../utils/operationalFilialRoutes";
import {
  fetchTnFilialyRows,
  getTnFilialyAreaPoRows,
} from "../../utils/tnFilialyApi";
import "../../components/operationalDashboard/css/OperationalDashboard.css";
import "./OperationalFilialPage.css";

const normalizeFilialName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");

const getPoNameBySlug = (filialRows, filialName, poSlug) => {
  if (!poSlug) return "";
  const normalizedFilialName = normalizeFilialName(filialName);
  const filialRow = (Array.isArray(filialRows) ? filialRows : []).find(
    (row) => normalizeFilialName(row?.name) === normalizedFilialName
  );
  const poRows = getTnFilialyAreaPoRows(filialRow);

  return poRows.find((row) => getOperationalPoSlug(row?.name) === poSlug)?.name || "";
};

const cleanWeatherPlaceName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:г\s*\.?\s*о\s*\.?|городской\s+округ|муниципальный\s+округ)\s*/iu, "")
    .replace(/\s*(?:г\s*\.?\s*о\s*\.?|городской\s+округ|муниципальный\s+округ)$/iu, "")
    .replace(/\s*(?:производственное\s+отделение|ПО|филиал)\s*$/iu, "")
    .trim();

const WEATHER_PLACE_BY_PO_KEY = new Map(
  [
    ["балашихинское", "Балашиха"],
    ["воскресенское", "Воскресенск"],
    ["гжельское", "Гжель"],
    ["голицынское", "Голицыно"],
    ["дзержинское", "Дзержинский"],
    ["долгопрудненское", "Долгопрудный"],
    ["домодедовское", "Домодедово"],
    ["дубненское", "Дубна"],
    ["егорьевское", "Егорьевск"],
    ["звенигородское", "Звенигород"],
    ["ильинское", "Ильинское"],
    ["истринское", "Истра"],
    ["каширское", "Кашира"],
    ["клинское", "Клин"],
    ["коломенское", "Коломна"],
    ["королёвское", "Королёв"],
    ["красногорское", "Красногорск"],
    ["краснознаменское", "Краснознаменск"],
    ["луховицкое", "Луховицы"],
    ["люберецкое", "Люберцы"],
    ["мытищинское", "Мытищи"],
    ["наро-фоминское", "Наро-Фоминск"],
    ["ногинское", "Ногинск"],
    ["одинцовское", "Одинцово"],
    ["орехово-зуевское", "Орехово-Зуево"],
    ["павлово-посадский", "Павловский Посад"],
    ["павлово-посадское", "Павловский Посад"],
    ["подольское", "Подольск"],
    ["пушкинское", "Пушкино"],
    ["раменское", "Раменское"],
    ["рузское", "Руза"],
    ["сергиево-посадское", "Сергиев Посад"],
    ["серпуховское", "Серпухов"],
    ["ступинское", "Ступино"],
    ["талдомский", "Талдом"],
    ["фрязинское", "Фрязино"],
    ["химкинское", "Химки"],
    ["чеховское", "Чехов"],
    ["шатурское", "Шатура"],
    ["щелковское", "Щёлково"],
    ["электростальское", "Электросталь"],
  ].map(([key, value]) => [normalizeLookupName(key), value])
);

const WEATHER_PLACE_BY_FILIAL_KEY = new Map(
  [
    ["домодедовский", "Домодедово"],
    ["коломенский", "Коломна"],
    ["красногорский", "Красногорск"],
    ["мытищинский", "Мытищи"],
    ["одинцовский", "Одинцово"],
    ["орехово-зуевский", "Орехово-Зуево"],
    ["павлово-посадский", "Павловский Посад"],
    ["раменский", "Раменское"],
    ["сергиево-посадский", "Сергиев Посад"],
    ["щелковский", "Щёлково"],
  ].map(([key, value]) => [normalizeLookupName(key), value])
);

const getWeatherPlaceFromPoName = (poName) => {
  const cleaned = cleanWeatherPlaceName(poName);
  return WEATHER_PLACE_BY_PO_KEY.get(normalizeLookupName(cleaned)) || cleaned;
};

const getWeatherPlaceFromFilialName = (filialName) => {
  const cleaned = cleanWeatherPlaceName(filialName);
  return WEATHER_PLACE_BY_FILIAL_KEY.get(normalizeLookupName(cleaned)) || cleaned;
};

const getRowAffectedPopulation = (row) =>
  toNumber(pick(row, "POPULATION_COUNT") ?? pick(row, "PONT_ALL"));

const buildFilialWeatherContext = ({ rows, filialName, poName, isPoLevel }) => {
  const normalizedFilial = normalizeLookupName(normalizeFilialName(filialName));
  const normalizedPo = normalizeLookupName(poName);
  const districtMap = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!isDashboardBaseType(row) || !isNotDeletedTN(row) || !isOpenTN(row)) return;

    const rowFilial = normalizeLookupName(normalizeFilialName(getOperationalBranchByRow(row)));
    if (normalizedFilial && rowFilial !== normalizedFilial) return;

    const rowPo = normalizeLookupName(getOperationalPoByRow(row));
    if (isPoLevel && normalizedPo && rowPo !== normalizedPo) return;

    const districtName = getOperationalDistrictByRow(row);
    const districtKey = normalizeDistrictLookupName(districtName) || normalizeLookupName(districtName);
    if (!districtKey) return;

    const item = districtMap.get(districtKey) || {
      districtName,
      place: cleanWeatherPlaceName(districtName),
      population: 0,
      tnCount: 0,
    };
    item.population += getRowAffectedPopulation(row);
    item.tnCount += 1;
    districtMap.set(districtKey, item);
  });

  const selectedDistrict = [...districtMap.values()].sort((left, right) => {
    const populationDiff = right.population - left.population;
    if (populationDiff) return populationDiff;
    const tnDiff = right.tnCount - left.tnCount;
    if (tnDiff) return tnDiff;
    return String(left.place || "").localeCompare(String(right.place || ""), "ru");
  })[0];

  if (selectedDistrict?.place) {
    return {
      level: isPoLevel ? "3 уровень" : "2 уровень",
      place: selectedDistrict.place,
      districtName: selectedDistrict.districtName,
      filialName,
      poName: isPoLevel ? poName : "",
      source: "открытые аварийные ТН текущего среза",
    };
  }

  const fallbackPlace = isPoLevel
    ? getWeatherPlaceFromPoName(poName)
    : getWeatherPlaceFromFilialName(filialName);

  return fallbackPlace
    ? {
        level: isPoLevel ? "3 уровень" : "2 уровень",
        place: fallbackPlace,
        districtName: "",
        filialName,
        poName: isPoLevel ? poName : "",
        source: "fallback без активного г.о.",
      }
    : null;
};

export default function OperationalFilialPage({
  MapPanelComponent = OperationalMapPanel,
  basePath = "/dashboard-oo",
  pageClassName = "",
}) {
  const { filialSlug, poSlug } = useParams();
  const loadData = useOperationalDashboardStore((store) => store.loadData);
  const reloadStats = useOperationalDashboardStore((store) => store.reloadStats);
  const rows = useOperationalDashboardStore((store) => store.rows);
  const isLoading = useOperationalDashboardStore((store) => store.isLoading);
  const hasLoaded = useOperationalDashboardStore((store) => store.hasLoaded);
  const hasStatsLoaded = useOperationalDashboardStore((store) => store.hasStatsLoaded);
  const filialRoute = getOperationalFilialRouteBySlug(filialSlug);
  const filialName = filialRoute?.name || "Филиал";
  const [filialRows, setFilialRows] = useState([]);
  const [filialRowsLoading, setFilialRowsLoading] = useState(true);
  const [hoveredAreaName, setHoveredAreaName] = useState("");
  const poName = useMemo(
    () => getPoNameBySlug(filialRows, filialName, poSlug),
    [filialName, filialRows, poSlug]
  );
  const poTitle = poName || (poSlug ? "ПО" : "");
  const isPoLevel = Boolean(poSlug);
  const filialPath = `${basePath}/${filialSlug}`;
  const backPath = isPoLevel ? `${basePath}/${filialSlug}` : basePath;
  const weatherContext = useMemo(
    () => buildFilialWeatherContext({ rows, filialName, poName, isPoLevel }),
    [filialName, isPoLevel, poName, rows]
  );

  useEffect(() => {
    if (!hasLoaded) {
      loadData({ includeStats: true });
    }
  }, [hasLoaded, loadData]);

  useEffect(() => {
    if (!hasLoaded || hasStatsLoaded) return;
    reloadStats();
  }, [hasLoaded, hasStatsLoaded, reloadStats]);

  useEffect(() => {
    let disposed = false;
    setFilialRowsLoading(true);
    fetchTnFilialyRows()
      .then((rows) => {
        if (!disposed) setFilialRows(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!disposed) setFilialRows([]);
      })
      .finally(() => {
        if (!disposed) setFilialRowsLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const shouldShowInitialLoader = !hasLoaded || filialRowsLoading;

  if (shouldShowInitialLoader) {
    return (
      <section
        className={[
          "operational-dashboard",
          "operational-filial-page",
          isPoLevel ? "operational-filial-page--po" : "",
          pageClassName,
        ].filter(Boolean).join(" ")}
      >
        <BrandSunLoader fullscreen size={74} text="Загружаем оперативную обстановку" />
      </section>
    );
  }

  return (
    <section
      className={[
        "operational-dashboard",
        "operational-filial-page",
        isPoLevel ? "operational-filial-page--po" : "",
        pageClassName,
      ].filter(Boolean).join(" ")}
    >
      <header className="operational-filial-page__header">
        <div className="operational-filial-page__nav">
          <Link className="operational-filial-page__back" to={backPath}>
            назад
          </Link>
          <OperationalNavigationSteps
            basePath={basePath}
            filialPath={filialPath}
            filialName={filialName}
            poName={poTitle}
          />
        </div>
        <div className="operational-filial-page__heading">
          <h1 className="operational-dashboard__title operational-filial-page__title">
            ОПЕРАТИВНАЯ ОБСТАНОВКА
          </h1>
        </div>
        <OperationalMapTopline
          className="operational-dashboard__topline operational-filial-page__topline"
          weatherContext={weatherContext}
        />
      </header>
      <div className="operational-dashboard__grid operational-filial-page__grid">
        <OperationalDonutsPanel
          className="operational-filial-page__panel"
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          groupBy={isPoLevel ? "okrug" : "po"}
        />
        <MapPanelComponent
          basePath={basePath}
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          districtDetailMode={isPoLevel}
          enableFilialNavigation={!isPoLevel}
          externalHoverName={hoveredAreaName}
          fillGroup={isPoLevel ? "district" : "po"}
          hoverGroup={isPoLevel ? "none" : "po"}
          showDistrictLabels
          showPesMarkers
          showTopline={false}
          weatherContext={weatherContext}
          variant="filial"
        />
        <OperationalDistrictsPanel
          className="operational-filial-page__panel"
          basePath={basePath}
          filialName={filialName}
          poName={poName}
          poSlug={poSlug}
          groupBy={isPoLevel ? "okrug" : "po"}
          onBranchHover={isPoLevel ? undefined : setHoveredAreaName}
        />
        <OperationalChartsPanel
          className="operational-filial-page__panel"
          filialName={filialName}
          filialRows={filialRows}
          poName={isPoLevel ? poName : ""}
          poSlug={isPoLevel ? poSlug : ""}
        />
      </div>
    </section>
  );
}
