import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Divider, Flex, Typography, message } from "antd";
import axios from "axios";
import { buildEddsPayload, sendToEdds } from "./Edds";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function SendBlock({ tn, documentId, refresh }) {
  const [sentEdds, setSentEdds] = useState(false);
  const [sentMes, setSentMes] = useState(false);
  const [eddsSelected, setEddsSelected] = useState(true);
  const [mesSelected, setMesSelected] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const d = tn?.data;
    const eddsSent = Boolean(d?.sendedEdds);
    const mesSent = Boolean(d?.sendedMosEnergoSbit);
    setSentEdds(eddsSent);
    setSentMes(mesSent);
    setEddsSelected(eddsSent ? false : true);
    setMesSelected(mesSent ? false : true);
  }, [
    tn?.data?.sendedEdds,
    tn?.data?.sendedMosEnergoSbit,
    tn?.data,
    documentId,
  ]);

  const eddsPayload = useMemo(() => buildEddsPayload(tn), [tn?.data]);

  const patchFlags = async (flags) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) throw new Error("Нет JWT");
    return axios.put(
      `${URL}/api/teh-narusheniyas/${documentId}`,
      { data: { ...flags } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
  };

  const handleTestEdds = () => {
    try {
      if (!eddsPayload) {
        message.warning("Нет данных для теста");
        return;
      }
      console.log(
        "ЕДДС: тестовый JSON без отправки →\n" +
          JSON.stringify(eddsPayload, null, 2)
      );
      message.success("Тест ЕДДС: JSON выведен в консоль");
    } catch (e) {
      console.error("Тест ЕДДС: ошибка подготовки JSON:", e);
      message.error("Тест ЕДДС: ошибка подготовки JSON");
    }
  };

  const handleSend = async () => {
    try {
      if (!eddsPayload) {
        message.error("Нет данных для отправки");
        return;
      }

      const toEdds = eddsSelected && !sentEdds;
      const toMes = mesSelected && !sentMes;

      if (!toEdds && !toMes) {
        message.warning("Выберите получателя перед отправкой");
        return;
      }

      setSending(true);

      if (toEdds) {
        const jwt = localStorage.getItem("jwt");
        const resp = await sendToEdds(URL, eddsPayload, jwt);
        if (
          resp?.success === true ||
          resp?.ok === true ||
          resp?.raw ||
          resp?.data
        ) {
          await patchFlags({ sendedEdds: true });
          setSentEdds(true);
          setEddsSelected(false);
          message.success("ЕДДС: отправлено");
        } else {
          const details =
            resp?.message ||
            (resp?.data ? JSON.stringify(resp.data) : "Ответ без сообщения");
          message.error("ЕДДС: ошибка — " + details);
        }
      }

      if (toMes) {
        console.log(
          "МосЭнергоСбыт: пока без реализации, JSON:\n" +
            JSON.stringify(eddsPayload, null, 2)
        );
        await patchFlags({ sendedMosEnergoSbit: true });
        setSentMes(true);
        setMesSelected(false);
        message.success("МосЭнергоСбыт: помечено как отправлено");
      }

      await refresh?.();
    } catch (e) {
      console.error("Ошибка при отправке:", e);
      message.error("Ошибка при отправке: " + (e?.message || "неизвестно"));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !sending && ((eddsSelected && !sentEdds) || (mesSelected && !sentMes));

  return (
    <div>
      <Typography.Text type="secondary">Отправка</Typography.Text>

      <Flex gap={16} align="center" style={{ marginTop: 8 }} wrap>
        <Checkbox
          checked={sentEdds || eddsSelected}
          disabled={sentEdds || sending}
          onChange={(e) => {
            if (sentEdds) return;
            setEddsSelected(e.target.checked);
          }}
        >
          ЕДДС
        </Checkbox>

        <Checkbox
          checked={sentMes || mesSelected}
          disabled={sentMes || sending}
          onChange={(e) => {
            if (sentMes) return;
            setMesSelected(e.target.checked);
          }}
        >
          МосЭнергоСбыт
        </Checkbox>

        <Button
          type="primary"
          onClick={handleSend}
          disabled={!canSend}
          loading={sending}
        >
          Отправить
        </Button>

        <Button onClick={handleTestEdds} disabled={sending || !eddsPayload}>
          Тест ЕДДС
        </Button>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
        После успешной отправки чекбокс блокируется. Проверяйте данные перед
        отправкой.
      </Typography.Paragraph>

      <Divider style={{ margin: "8px 0 0" }} />
    </div>
  );
}

// import React, { useEffect, useMemo, useState } from "react";
// import { Button, Checkbox, Divider, Flex, Typography, message } from "antd";
// import dayjs from "dayjs";
// import axios from "axios";

// const URL = import.meta.env.VITE_URL_BACKEND;

// const DISTRICT_MAP = {
//   "Балашиха г.о.": "4",
//   "Богородский г.о.": "81",
//   "Бронницы г.о.": "5",
//   "Власиха (ЗАТО) г.о.": "84",
//   "Волоколамск г.о.": "6",
//   "Воскресенск г.о.": "7",
//   "Восход (ЗАТО) г.о.": "85",
//   "Дзержинский г.о.": "16",
//   "Дмитровский г.о.": "17",
//   "Долгопрудный г.о.": "18",
//   "Домодедово г.о.": "19",
//   "Дубна г.о.": "20",
//   "Егорьевск г.о.": "21",
//   "Жуковский г.о.": "23",
//   "Зарайск г.о.": "24",
//   "Звездный городок г.о.": "91",
//   "Истра г.о.": "27",
//   "Кашира г.о.": "28",
//   "Клин г.о.": "31",
//   "Коломна г.о.": "32",
//   "Королев г.о.": "34",
//   "Котельники г.о.": "83",
//   "Красногорск г.о.": "36",
//   "Краснознаменск г.о.": "37",
//   "Ленинский г.о.": "38",
//   "Лобня г.о.": "39",
//   "Лосино-Петровский г.о.": "88",
//   "Лотошино г.о.": "40",
//   "Луховицы г.о.": "41",
//   "Лыткарино г.о.": "42",
//   "Люберцы г.о.": "43",
//   "Можайский г.о.": "44",
//   "Молодежный (ЗАТО) г.о.": "90",
//   "Мытищи г.о.": "46",
//   "Наро-Фоминский г.о.": "48",
//   "Одинцовский г.о.": "50",
//   "Орехово-Зуевский г.о.": "52",
//   "Павлово-Посадский г.о.": "54",
//   "Подольск г.о.": "56",
//   "Протвино г.о.": "57",
//   "Пушкинский г.о.": "58",
//   "Пущино г.о.": "59",
//   "Раменский г.о.": "60",
//   "Реутов г.о.": "62",
//   "Рузский г.о.": "63",
//   "Сергиево-Посадский г.о.": "64",
//   "Серебряные Пруды г.о.": "65",
//   "Серпухов г.о.": "66",
//   "Солнечногорск г.о.": "68",
//   "Ступино г.о.": "70",
//   "Талдомский г.о.": "71",
//   "Фрязино г.о.": "72",
//   "Химки г.о.": "73",
//   "Черноголовка г.о.": "92",
//   "Чехов г.о.": "74",
//   "Шатура г.о.": "76",
//   "Шаховская г.о.": "77",
//   "Щелково г.о.": "78",
//   "Электрогорск г.о.": "89",
//   "Электросталь г.о.": "79",
// };

// const TYPE_MAP = {
//   "Аварийная заявка": "1",
//   "Неплановая заявка": "2",
//   "Плановая заявка": "3",
//   А: "1",
//   В: "2",
//   П: "3",
// };

// const STATUS_NAME_MAP = {
//   Открыта: "1",
//   Запитана: "4",
//   Удалена: "6",
// };

// function toDate(v, withTime = false) {
//   if (!v) return null;
//   const d = dayjs(v);
//   if (!d.isValid()) return null;
//   return withTime ? d.format("YYYY-MM-DD HH:mm:ss") : d.format("YYYY-MM-DD");
// }

// function clean(v) {
//   if (v === "—" || v === undefined || v === null || v === "") return null;
//   return String(v);
// }

// function valOrZero(v) {
//   if (v === "—" || v === undefined || v === null || v === "") return "0";
//   return String(v);
// }

// function buildMkdFromFiasList(str) {
//   if (!str || typeof str !== "string") return [];
//   return str
//     .split(/[,;]+/)
//     .map((s) => s.trim())
//     .filter(Boolean)
//     .map((fias) => ({ fias: fias.toLowerCase() }));
// }

// export default function SendBlock({ tn, documentId, refresh }) {
//   const [sentEdds, setSentEdds] = useState(false);
//   const [sentMes, setSentMes] = useState(false);
//   const [eddsSelected, setEddsSelected] = useState(true);
//   const [mesSelected, setMesSelected] = useState(true);
//   const [sending, setSending] = useState(false);

//   // useEffect(() => {
//   //   const d = tn?.data;
//   //   setSentEdds(Boolean(d?.sendedEdds));
//   //   setSentMes(Boolean(d?.sendedMosEnergoSbit));
//   //   if (d?.sendedEdds) setEddsSelected(false);
//   //   if (d?.sendedMosEnergoSbit) setMesSelected(false);
//   // }, [tn?.data?.sendedEdds, tn?.data?.sendedMosEnergoSbit, tn?.data]);

//   useEffect(() => {
//     const d = tn?.data;
//     const eddsSent = Boolean(d?.sendedEdds);
//     const mesSent = Boolean(d?.sendedMosEnergoSbit);

//     setSentEdds(eddsSent);
//     setSentMes(mesSent);

//     // если уже отправлено — галку не ставим; если нет — ставим автоматически
//     setEddsSelected(eddsSent ? false : true);
//     setMesSelected(mesSent ? false : true);
//   }, [
//     tn?.data?.sendedEdds,
//     tn?.data?.sendedMosEnergoSbit,
//     tn?.data,
//     documentId,
//   ]);

//   const eddsPayload = useMemo(() => {
//     const obj = tn?.data;
//     if (!obj) return null;
//     const raw = obj?.data || {};

//     const incidentId = raw.VIOLATION_GUID_STR || obj.guid || null;

//     const typeSrc = raw.VIOLATION_TYPE || obj.type || null;
//     const type =
//       TYPE_MAP[typeSrc] || TYPE_MAP[String(typeSrc || "").trim()] || null;

//     const statusSrc = raw.STATUS_NAME || obj.status || null;
//     const status =
//       STATUS_NAME_MAP[
//         String(statusSrc || "")
//           .trim()
//           .replace(/^./, (c) => c.toUpperCase())
//       ] || null;

//     const timeCreate =
//       toDate(raw.F81_060_EVENTDATETIME || obj.createDateTime, true) || null;

//     const planDateClose =
//       toDate(raw.F81_070_RESTOR_SUPPLAYDATETIME || obj.recoveryPlanDateTime) ||
//       null;

//     const districtName =
//       raw.DISTRICT || raw.SCNAME || obj.district || obj.dispCenter || null;
//     const districtId = DISTRICT_MAP[districtName] || null;

//     const countPeople =
//       raw.POPULATION_COUNT ?? raw.population_count ?? obj.count_people ?? null;

//     const fioWork = raw.CREATE_USER || obj.fio_response_work || null;
//     const fioPhone = raw.fio_response_phone || obj.fio_response_phone || null;

//     const description =
//       obj.description || raw.F81_042_DISPNAME || raw.DESCRIPTION || null;

//     const resources = Array.isArray(obj.resources) ? obj.resources : [5];

//     const mkdAll = clean(raw.MKD_ALL);
//     const clinicsAll = clean(raw.CLINICS_ALL);
//     const hospitalsAll = clean(raw.HOSPITALS_ALL);
//     const schoolsAll = clean(raw.SCHOOLS_ALL);
//     const kindergartensAll = clean(raw.KINDERGARTENS_ALL);
//     const boilerAll = clean(raw.BOILER_ALL);
//     const ctpAll = clean(raw.CTP_ALL);
//     const knsAll = clean(raw.KNS_ALL);
//     const wellsAll = clean(raw.WELLS_ALL);
//     const vnsAll = clean(raw.VNS_ALL);
//     const rpsnAll = clean(raw.RPSN_ALL);
//     const ps35All = clean(raw.PS35_ALL);
//     const ps110All = clean(raw.PS110_ALL);
//     const tpAll = clean(raw.TP_ALL);
//     const line110All = clean(raw.LINE110_ALL);
//     const line35All = clean(raw.LINE35_ALL);
//     const lineSnAll = clean(raw.LINESN_ALL);
//     const settlementCount = clean(raw.SETTLEMENT_COUNT);

//     const involved = {
//       involved_brigades: clean(raw.BRIGADECOUNT),
//       involved_workers: clean(raw.EMPLOYEECOUNT),
//       involved_equipment: clean(raw.SPECIALTECHNIQUECOUNT),
//       involved_emergency_power_supply: clean(raw.PES_COUNT),
//     };

//     const required = {
//       required_brigades: valOrZero(raw.need_brigade_count),
//       required_workers: valOrZero(raw.need_person_count),
//       required_equipment: valOrZero(raw.need_equipment_count),
//       required_emergency_power_supply: valOrZero(
//         raw.need_reserve_power_source_count
//       ),
//     };

//     const mkd = buildMkdFromFiasList(
//       raw.FIAS_LIST || obj.FIAS_LIST || obj.house_fias_list
//     );

//     const out = {};

//     if (incidentId) out["incident_id"] = String(incidentId);
//     if (type) out["type"] = String(type);
//     if (status) out["status"] = String(status);
//     if (timeCreate) out["time_create"] = timeCreate;
//     if (planDateClose) out["plan_date_close"] = planDateClose;
//     if (districtId) out["district_id"] = String(districtId);
//     if (countPeople != null) out["count_people"] = String(Number(countPeople));
//     if (fioWork) out["fio_response_work"] = String(fioWork);
//     if (fioPhone) out["fio_response_phone"] = String(fioPhone);
//     if (description) out["description"] = String(description);
//     if (Array.isArray(resources)) out["resources"] = resources.map(Number);

//     if (mkdAll != null) out["mkd_count"] = String(mkdAll);
//     if (settlementCount != null) out["places_count"] = String(settlementCount);

//     if (hospitalsAll != null) out["hospital_count"] = String(hospitalsAll);
//     if (clinicsAll != null) out["polyclinic_count"] = String(clinicsAll);
//     if (schoolsAll != null) out["school_count"] = String(schoolsAll);
//     if (kindergartensAll != null)
//       out["kindergarten_count"] = String(kindergartensAll);
//     if (boilerAll != null) out["boiler_room_count"] = String(boilerAll);
//     if (wellsAll != null) out["water_intake_count"] = String(wellsAll);
//     if (knsAll != null) out["canalization_pumping_count"] = String(knsAll);

//     const socialSummParts = [
//       mkdAll,
//       clinicsAll,
//       hospitalsAll,
//       schoolsAll,
//       kindergartensAll,
//       boilerAll,
//       wellsAll,
//       knsAll,
//     ].map((v) => (v == null ? 0 : Number(v) || 0));
//     const socialSum = socialSummParts.reduce((a, b) => a + b, 0);
//     if (socialSum > 0) out["social_objects_summ"] = String(socialSum);

//     const electric_lines = {
//       "110kv_count": line110All,
//       "35kv_count": line35All,
//       "6_20kv_count": lineSnAll,
//       "04kv_count": null,
//     };
//     if (
//       electric_lines["110kv_count"] != null ||
//       electric_lines["35kv_count"] != null ||
//       electric_lines["6_20kv_count"] != null ||
//       electric_lines["04kv_count"] != null
//     ) {
//       out["electric_lines"] = Object.fromEntries(
//         Object.entries(electric_lines).filter(([, v]) => v != null)
//       );
//     }

//     const energy_substation = {
//       "110kv_count": ps110All,
//       "35kv_count": ps35All,
//     };
//     if (
//       energy_substation["110kv_count"] != null ||
//       energy_substation["35kv_count"] != null
//     ) {
//       out["energy_substation"] = Object.fromEntries(
//         Object.entries(energy_substation).filter(([, v]) => v != null)
//       );
//     }

//     const transformer_station = {
//       "6_20kv_count": tpAll,
//     };
//     if (transformer_station["6_20kv_count"] != null) {
//       out["transformer_station"] = transformer_station;
//     }

//     const distribution_station = {
//       "110kv_count": null,
//       "35kv_count": null,
//       "6_20kv_count": rpsnAll,
//     };
//     if (
//       distribution_station["110kv_count"] != null ||
//       distribution_station["35kv_count"] != null ||
//       distribution_station["6_20kv_count"] != null
//     ) {
//       out["distribution_station"] = Object.fromEntries(
//         Object.entries(distribution_station).filter(([, v]) => v != null)
//       );
//     }

//     const involved_forces = {
//       involved_brigades: involved.involved_brigades,
//       involved_workers: involved.involved_workers,
//       involved_equipment: involved.involved_equipment,
//       involved_emergency_power_supply: involved.involved_emergency_power_supply,
//     };
//     if (
//       involved_forces.involved_brigades != null ||
//       involved_forces.involved_workers != null ||
//       involved_forces.involved_equipment != null ||
//       involved_forces.involved_emergency_power_supply != null
//     ) {
//       out["involved_forces"] = Object.fromEntries(
//         Object.entries(involved_forces).filter(([, v]) => v != null)
//       );
//     }

//     const required_forces = {
//       required_brigades: required.required_brigades,
//       required_workers: required.required_workers,
//       required_equipment: required.required_equipment,
//       required_emergency_power_supply: required.required_emergency_power_supply,
//     };
//     if (
//       required_forces.required_brigades != null ||
//       required_forces.required_workers != null ||
//       required_forces.required_equipment != null ||
//       required_forces.required_emergency_power_supply != null
//     ) {
//       out["required_forces"] = Object.fromEntries(
//         Object.entries(required_forces).filter(([, v]) => v != null)
//       );
//     }

//     if (Array.isArray(mkd) && mkd.length > 0) out["mkd"] = mkd;

//     out["snt_objects"] = [];
//     out["school_objects"] = [];
//     out["kindergarten_objects"] = [];
//     out["hospital_objects"] = [];
//     out["polyclinic_objects"] = [];
//     out["boiler_room_objects"] = [];
//     out["water_intake_objects"] = [];
//     out["canalization_pumping_objects"] = [];

//     const lat = clean(raw.lat || raw.LAT);
//     const lon = clean(raw.lon || raw.LON);
//     if (lat) out["lat"] = String(lat);
//     if (lon) out["lon"] = String(lon);

//     return out;
//   }, [tn?.data]);

//   const patchFlags = async (flags) => {
//     const jwt = localStorage.getItem("jwt");
//     if (!jwt) throw new Error("Нет JWT");
//     return axios.put(
//       `${URL}/api/teh-narusheniyas/${documentId}`,
//       { data: { ...flags } },
//       { headers: { Authorization: `Bearer ${jwt}` } }
//     );
//   };

//   const sendToEdds = async (data) => {
//     const jwt = localStorage.getItem("jwt");
//     const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
//     try {
//       console.log("ЕДДС: отправляю JSON →\n" + JSON.stringify(data, null, 2));
//       const res = await axios.post(`${URL}/services/edds/`, data, {
//         headers,
//         timeout: 30000,
//       });
//       return res?.data;
//     } catch (e) {
//       const apiMsg =
//         e?.response?.data?.message ||
//         e?.response?.data?.error ||
//         e?.message ||
//         "Неизвестная ошибка";
//       throw new Error(apiMsg);
//     }
//   };

//   const handleTestEdds = () => {
//     try {
//       if (!eddsPayload) {
//         message.warning("Нет данных для теста");
//         return;
//       }
//       console.log("ЕДДС: тестовый JSON без отправки →\n" + JSON.stringify(eddsPayload, null, 2));
//       message.success("Тест ЕДДС: JSON выведен в консоль");
//     } catch (e) {
//       console.error("Тест ЕДДС: ошибка подготовки JSON:", e);
//       message.error("Тест ЕДДС: ошибка подготовки JSON");
//     }
//   };

//   const handleSend = async () => {
//     try {
//       if (!eddsPayload) {
//         message.error("Нет данных для отправки");
//         return;
//       }

//       const toEdds = eddsSelected && !sentEdds;
//       const toMes = mesSelected && !sentMes;

//       if (!toEdds && !toMes) {
//         message.warning("Выберите получателя перед отправкой");
//         return;
//       }

//       setSending(true);

//       if (toEdds) {
//         const resp = await sendToEdds(eddsPayload);
//         if (
//           resp?.success === true ||
//           resp?.ok === true ||
//           resp?.raw ||
//           resp?.data
//         ) {
//           await patchFlags({ sendedEdds: true });
//           setSentEdds(true);
//           setEddsSelected(false);
//           message.success("ЕДДС: отправлено");
//         } else {
//           const details =
//             resp?.message ||
//             (resp?.data ? JSON.stringify(resp.data) : "Ответ без сообщения");
//           message.error("ЕДДС: ошибка — " + details);
//         }
//       }

//       if (toMes) {
//         console.log(
//           "МосЭнергоСбыт: пока без реализации, JSON:\n" +
//             JSON.stringify(eddsPayload, null, 2)
//         );
//         await patchFlags({ sendedMosEnergoSbit: true });
//         setSentMes(true);
//         setMesSelected(false);
//         message.success("МосЭнергоСбыт: помечено как отправлено");
//       }

//       await refresh?.();
//     } catch (e) {
//       console.error("Ошибка при отправке:", e);
//       message.error("Ошибка при отправке: " + (e?.message || "неизвестно"));
//     } finally {
//       setSending(false);
//     }
//   };

//   const canSend =
//     !sending && ((eddsSelected && !sentEdds) || (mesSelected && !sentMes));

//   return (
//     <div>
//       <Typography.Text type="secondary">Отправка</Typography.Text>

//       <Flex gap={16} align="center" style={{ marginTop: 8 }} wrap>
//         <Checkbox
//           checked={sentEdds || eddsSelected}
//           disabled={sentEdds || sending}
//           onChange={(e) => {
//             if (sentEdds) return;
//             setEddsSelected(e.target.checked);
//           }}
//         >
//           ЕДДС
//         </Checkbox>

//         <Checkbox
//           checked={sentMes || mesSelected}
//           disabled={sentMes || sending}
//           onChange={(e) => {
//             if (sentMes) return;
//             setMesSelected(e.target.checked);
//           }}
//         >
//           МосЭнергоСбыт
//         </Checkbox>

//         <Button
//           type="primary"
//           onClick={handleSend}
//           disabled={!canSend}
//           loading={sending}
//         >
//           Отправить
//         </Button>

//         <Button onClick={handleTestEdds} disabled={sending || !eddsPayload}>
//           Тест ЕДДС
//         </Button>
//       </Flex>

//       <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
//         После успешной отправки чекбокс блокируется. Проверяйте данные перед
//         отправкой.
//       </Typography.Paragraph>

//       <Divider style={{ margin: "8px 0 0" }} />
//     </div>
//   );
// }
