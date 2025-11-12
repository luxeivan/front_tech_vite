import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Spin } from "antd";
import axios from "axios";
const URL = import.meta.env.VITE_URL_BACKEND;

/* -------- helpers (минимальный набор) -------- */
const pick = (obj, key) =>
  obj?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

const districtName = (row) =>
  pick(row, "DISTRICT") || row?.dispCenter || row?.district || "—";

const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);

  return v === true || v === 1 || v === "true";
};

const s = (v) =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

const classifySocialTyp = (t) => {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hosp";
  if (x.includes("поликлин")) return "clinics";
  if (x.includes("котель")) return "boilers";
  if (x.includes("взу") || x.includes("скваж")) return "vzu";
  if (x.includes("внс")) return "vns";
  if (x.includes("ижс")) return "izhs";
  if (x.includes("снт")) return "snt";
  return null;
};

// Число из строки/числа безопасно
const toNumber = (v) => {
  if (v == null) return 0;
  // unwrap { value: ... }
  if (typeof v === "object" && "value" in v) return toNumber(v.value);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const normalized = v.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

// Кол-во отключённых людей из строки ТН
const getRowPeopleCount = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  // 1) Явные поля
  const fields = [
    // приоритет — как в блоке InfoTN
    "POPULATION_COUNT",
    "populationCount",
    "POPULATION_CNT",
    "PEOPLE_COUNT",
    "peopleCount",
    "AFFECTED_POPULATION",
    "affectedPopulation",
    // прежние ключи
    "PEOPLE_OFF",
    "peopleOff",
    "PEOPLE",
    "PEOPLE_ALL",
    "AFFECTED_PEOPLE",
    "affectedPeople",
    "RESIDENTS_OFF",
    "residentsOff",
    "CITIZENS_OFF",
    "citizensOff",
    "POPULATION_OFF",
    "populationOff",
    "POPULATION",
    "population",
    "ABONENTS_OFF", // иногда путают «абонентов» и «людей»
    "abonentsOff",
  ];
  for (const f of fields) {
    const val = raw[f];
    if (val != null && toNumber(val) > 0) return toNumber(val);
  }
  // 2) Попробуем собрать из SocialObjects
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];
  if (socials.length) {
    let sum = 0;
    socials.forEach((it) => {
      const v =
        it?.People ??
        it?.PEOPLE ??
        it?.Population ??
        it?.population ??
        it?.Residents ??
        it?.residents ??
        0;
      sum += toNumber(v);
    });
    if (sum > 0) return sum;
  }
  return 0;
};

// Подсчёт СЗО для одной строки ТН (уникализируем по FIAS/Name; при отсутствии массива — фолбэки по *_ALL)
const getRowSzoCounts = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];
  const base = {
    people: 0,
    boilers: 0,
    ctp: 0,
    hosp: 0,
    clinics: 0,
    schools: 0,
    kindergartens: 0,
    vzu: 0,
    vns: 0,
    mkd: 0,
    izhs: 0,
    snt: 0,
  };

  if (socials.length) {
    const seen = {
      mkd: new Set(),
      schools: new Set(),
      kindergartens: new Set(),
      hosp: new Set(),
      clinics: new Set(),
      boilers: new Set(),
      vzu: new Set(),
      vns: new Set(),
      izhs: new Set(),
      snt: new Set(),
    };
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      const uniq =
        s(it?.FIAS).toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seen[key].has(uniq)) return;
      seen[key].add(uniq);
      base[key] += 1;
    });
  } else {
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    base.boilers = num(raw.BOILER_ALL);
    base.ctp = num(raw.CTP_ALL);
    base.hosp = num(raw.HOSPITALS_ALL);
    base.clinics = num(raw.CLINICS_ALL);
    base.schools = num(raw.SCHOOLS_ALL ?? raw.SCHOOL_ALL);
    base.kindergartens = num(
      raw.KINDERGARTENS_ALL ?? raw.KINDERGARTEN_ALL ?? raw.KINDERGARDENS_ALL
    );
    base.vzu = num(raw.WELLS_ALL);
    base.vns = num(raw.VNS_ALL);
    base.mkd = num(raw.MKD_ALL);
    base.izhs = num(raw.PRIVATE_HOUSE_ALL);
    base.snt = num(raw.SNT_ALL);
  }
  // Количество отключённых людей
  base.people = getRowPeopleCount(row);
  return base;
};

/* -------- Компонент блока 5 -------- */
export default function RegionSZO({ rowsOpen, loadingExternal }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const useExternal = Array.isArray(rowsOpen);

  const loadOpen = async () => {
    try {
      setLoading(true);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      const qsOpen = [
        "pagination[page]=1",
        "pagination[pageSize]=500",
        "sort[0]=createDateTime:DESC",
        "filters[isActive][$eq]=true",
      ].join("&");

      const headers = { Authorization: `Bearer ${jwt}` };
      const resp = await axios.get(`${URL}/api/teh-narusheniyas?${qsOpen}`, {
        headers,
      });

      const list = Array.isArray(resp?.data?.data)
        ? resp.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      setRows(list.filter(isOpenTN));
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    if (!useExternal) {
      loadOpen();
    }
  }, [useExternal]);

  // SSE автообновление
  const esRef = useRef(null);
  useEffect(() => {
    if (useExternal || !URL) return;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(loadOpen, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(loadOpen, 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch {}
  }, [useExternal]);

  const effectiveRows = useExternal ? rowsOpen : rows;
  const effectiveLoading = useExternal ? !!loadingExternal : loading;

  // агрегируем по округам
  const rowsView = useMemo(() => {
    const acc = new Map(); // district -> sums
    effectiveRows.forEach((r) => {
      const d = districtName(r);
      const z = getRowSzoCounts(r);
      if (!acc.has(d))
        acc.set(d, {
          people: 0,
          boilers: 0,
          ctp: 0,
          hosp: 0,
          clinics: 0,
          schools: 0,
          kindergartens: 0,
          vzu: 0,
          vns: 0,
          mkd: 0,
          izhs: 0,
          snt: 0,
          telecom: 0, // на будущее
        });
      const dst = acc.get(d);
      Object.keys(dst).forEach((k) => {
        if (k === "telecom") return;
        dst[k] += Number(z[k] || 0);
      });
    });

    return Array.from(acc.entries()).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]), "ru")
    );
  }, [effectiveRows]);

  const th = {
    padding: "6px 8px",
    fontWeight: 700,
    fontSize: 12,
    background: "#fafafa",
    borderBottom: "1px solid #eee",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  const td = {
    padding: "6px 8px",
    fontSize: 12,
    textAlign: "center",
    borderBottom: "1px solid #f0f0f0",
  };

  const fmtInt = (n) => new Intl.NumberFormat("ru-RU").format(Number(n || 0));

  return (
    <Card
      style={{ borderRadius: 20, marginTop: 8 }}
      title={
        <div style={{ fontWeight: 700, color: "#1575bc" }}>
          Информация об отключениях СЗО в разрезе городских округов
        </div>
      }
      styles={{ body: { padding: 10 } }}
    >
      {effectiveLoading && effectiveRows.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
          <Spin />
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Городской округ</th>
                <th style={th} title="Количество отключённых людей">Чел</th>
                <th style={th}>Котельные</th>
                <th style={th}>ЦТП</th>
                <th style={th}>Больницы</th>
                <th style={th}>Поликл</th>
                <th style={th}>Школы</th>
                <th style={th}>Дет.сады</th>
                <th style={th}>ВЗУ</th>
                <th style={th}>ВНС</th>
                <th style={th}>МКД</th>
                <th style={th}>ИЖС</th>
                <th style={th}>СНТ</th>
                <th style={th}>ОС</th>
              </tr>
            </thead>
            <tbody>
              {rowsView.map(([d, v], i) => (
                <tr key={d} style={{ background: i % 2 ? "#fff" : "#fcfcfc" }}>
                  <td style={{ ...td, textAlign: "left" }}>{d}</td>
                  <td style={td}>{fmtInt(v.people || 0)}</td>
                  <td style={td}>{v.boilers || 0}</td>
                  <td style={td}>{v.ctp || 0}</td>
                  <td style={td}>{v.hosp || 0}</td>
                  <td style={td}>{v.clinics || 0}</td>
                  <td style={td}>{v.schools || 0}</td>
                  <td style={td}>{v.kindergartens || 0}</td>
                  <td style={td}>{v.vzu || 0}</td>
                  <td style={td}>{v.vns || 0}</td>
                  <td style={td}>{v.mkd || 0}</td>
                  <td style={td}>{v.izhs || 0}</td>
                  <td style={td}>{v.snt || 0}</td>
                  <td style={td}>{v.telecom || 0}</td>
                </tr>
              ))}
              {rowsView.length === 0 && (
                <tr>
                  <td style={{ ...td, textAlign: "left" }} colSpan={14}>
                    Нет данных
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
