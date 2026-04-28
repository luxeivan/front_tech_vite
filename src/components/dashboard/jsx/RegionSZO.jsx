import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Spin } from "antd";
import axios from "axios";
import {
  URL,
  districtName,
  getRowSzoCounts,
  isDashboardViolationType,
  isOpenTN,
} from "../js/dashboardCommon"; // Общие хелперы dashboard.

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
        "filters[VIOLATION_TYPE][$in][0]=А",
        "filters[VIOLATION_TYPE][$in][1]=В",
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

      setRows(list.filter((row) => isOpenTN(row) && isDashboardViolationType(row)));
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
          points: 0,
          boilers: 0,
          ctp: 0,
          hosp: 0,
          clinics: 0,
          schools: 0,
          kindergartens: 0,
          vzu: 0,
          vns: 0,
          kns: 0,
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
    whiteSpace: "normal",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.2,
    verticalAlign: "middle",
    wordBreak: "break-word",
  };
  const td = {
    padding: "6px 8px",
    fontSize: 12,
    textAlign: "center",
    borderBottom: "1px solid #f0f0f0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "middle",
  };

  const fmtInt = (n) => new Intl.NumberFormat("ru-RU").format(Number(n || 0));
  const columnsCount = 16;
  const colWidth = `${100 / columnsCount}%`;

  return (
    <Card
      style={{ borderRadius: 20, marginTop: 14 }}
      title={
        <div style={{ fontWeight: 700, color: "#1575bc" }}>
          Информация о масштабах отключения в разрезе городских округов
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
          <table
            style={{
              width: "100%",
              minWidth: 1320,
              tableLayout: "fixed",
              borderCollapse: "collapse",
            }}
          >
            <colgroup>
              {Array.from({ length: columnsCount }).map((_, index) => (
                <col key={index} style={{ width: colWidth }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Городской округ</th>
                <th style={th} title="Количество отключённых людей">Население</th>
                <th style={th}>Точки поставки</th>
                <th style={th}>Котельные</th>
                <th style={th}>ЦТП</th>
                <th style={th}>Больницы</th>
                <th style={th}>Поликлиники</th>
                <th style={th}>Школы</th>
                <th style={th}>Детские сады</th>
                <th style={th}>ВЗУ</th>
                <th style={th}>ВНС</th>
                <th style={th}>КНС</th>
                <th style={th}>МКД</th>
                <th style={th}>ИЖС</th>
                <th style={th}>СНТ</th>
                <th style={th}>ОС</th>
              </tr>
            </thead>
            <tbody>
              {rowsView.map(([d, v], i) => (
                <tr key={d} style={{ background: i % 2 ? "#fff" : "#fcfcfc" }}>
                  <td
                    style={{ ...td, textAlign: "left", whiteSpace: "normal", wordBreak: "break-word" }}
                    title={d}
                  >
                    {d}
                  </td>
                  <td style={td}>{fmtInt(v.people || 0)}</td>
                  <td style={td}>{fmtInt(v.points || 0)}</td>
                  <td style={td}>{v.boilers || 0}</td>
                  <td style={td}>{v.ctp || 0}</td>
                  <td style={td}>{v.hosp || 0}</td>
                  <td style={td}>{v.clinics || 0}</td>
                  <td style={td}>{v.schools || 0}</td>
                  <td style={td}>{v.kindergartens || 0}</td>
                  <td style={td}>{v.vzu || 0}</td>
                  <td style={td}>{v.vns || 0}</td>
                  <td style={td}>{v.kns || 0}</td>
                  <td style={td}>{v.mkd || 0}</td>
                  <td style={td}>{v.izhs || 0}</td>
                  <td style={td}>{v.snt || 0}</td>
                  <td style={td}>{v.telecom || 0}</td>
                </tr>
              ))}
              {rowsView.length === 0 && (
                <tr>
                  <td style={{ ...td, textAlign: "left" }} colSpan={columnsCount}>
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
