import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Divider, Flex, Typography, message } from "antd";
import axios from "axios";
import { buildEddsPayload, sendToEdds } from "./Edds";
import { buildMosEnergoSbytPayload, sendToMes } from "./MosEnergoSbyt";

const URL = import.meta.env.VITE_URL_BACKEND

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
  const mesPayload = useMemo(() => buildMosEnergoSbytPayload(tn), [tn?.data]);

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

  const handleTestMes = () => {
    try {
      if (!mesPayload) {
        message.warning("Нет данных для теста МосЭнергоСбыта");
        return;
      }
      console.log(
        "МосЭнергоСбыт: тестовый JSON без отправки →\n" +
          JSON.stringify(mesPayload, null, 2)
      );
      message.success("Тест МосЭнергоСбыт: JSON выведен в консоль");
    } catch (e) {
      console.error("Тест МосЭнергоСбыт: ошибка подготовки JSON:", e);
      message.error("Тест МосЭнергоСбыт: ошибка подготовки JSON");
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

      // === ЕДДС (без изменений) ===
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

      // === МосЭнергоСбыт: реальная отправка на наш роутер ===
      if (toMes) {
        if (!mesPayload) {
          message.error("МосЭнергоСбыт: нет данных для отправки");
        } else {
          const jwt = localStorage.getItem("jwt"); // не обязателен
          const resp = await sendToMes(URL, mesPayload, jwt);
          if (resp?.ok === true) {
            const dry = resp?.dryRun ? " (тестовый режим)" : "";
            await patchFlags({ sendedMosEnergoSbit: true });
            setSentMes(true);
            setMesSelected(false);
            message.success(
              `МосЭнергоСбыт: отправлено${dry}${
                resp?.id_registry ? `, id_registry=${resp.id_registry}` : ""
              }`
            );
            console.log("МосЭнергоСбыт ответ:", JSON.stringify(resp, null, 2));
          } else {
            const details =
              resp?.message ||
              (resp?.data ? JSON.stringify(resp.data) : "Ответ без сообщения");
            message.error("МосЭнергоСбыт: ошибка — " + details);
          }
        }
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
        <Button onClick={handleTestMes} disabled={sending || !mesPayload}>
          Тест МосЭнергоСбыт
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
// import axios from "axios";
// import { buildEddsPayload, sendToEdds } from "./Edds";
// import { buildMosEnergoSbytPayload } from "./MosEnergoSbyt";

// const URL = import.meta.env.VITE_URL_BACKEND;

// export default function SendBlock({ tn, documentId, refresh }) {
//   const [sentEdds, setSentEdds] = useState(false);
//   const [sentMes, setSentMes] = useState(false);
//   const [eddsSelected, setEddsSelected] = useState(true);
//   const [mesSelected, setMesSelected] = useState(true);
//   const [sending, setSending] = useState(false);

//   useEffect(() => {
//     const d = tn?.data;
//     const eddsSent = Boolean(d?.sendedEdds);
//     const mesSent = Boolean(d?.sendedMosEnergoSbit);
//     setSentEdds(eddsSent);
//     setSentMes(mesSent);
//     setEddsSelected(eddsSent ? false : true);
//     setMesSelected(mesSent ? false : true);
//   }, [
//     tn?.data?.sendedEdds,
//     tn?.data?.sendedMosEnergoSbit,
//     tn?.data,
//     documentId,
//   ]);

//   const eddsPayload = useMemo(() => buildEddsPayload(tn), [tn?.data]);
//   const mesPayload = useMemo(() => buildMosEnergoSbytPayload(tn), [tn?.data]);

//   const patchFlags = async (flags) => {
//     const jwt = localStorage.getItem("jwt");
//     if (!jwt) throw new Error("Нет JWT");
//     return axios.put(
//       `${URL}/api/teh-narusheniyas/${documentId}`,
//       { data: { ...flags } },
//       { headers: { Authorization: `Bearer ${jwt}` } }
//     );
//   };

//   const handleTestEdds = () => {
//     try {
//       if (!eddsPayload) {
//         message.warning("Нет данных для теста");
//         return;
//       }
//       console.log(
//         "ЕДДС: тестовый JSON без отправки →\n" +
//           JSON.stringify(eddsPayload, null, 2)
//       );
//       message.success("Тест ЕДДС: JSON выведен в консоль");
//     } catch (e) {
//       console.error("Тест ЕДДС: ошибка подготовки JSON:", e);
//       message.error("Тест ЕДДС: ошибка подготовки JSON");
//     }
//   };

//   const handleTestMes = () => {
//     try {
//       if (!mesPayload) {
//         message.warning("Нет данных для теста МосЭнергоСбыта");
//         return;
//       }
//       console.log(
//         "МосЭнергоСбыт: тестовый JSON без отправки →\n" +
//           JSON.stringify(mesPayload, null, 2)
//       );
//       message.success("Тест МосЭнергоСбыт: JSON выведен в консоль");
//     } catch (e) {
//       console.error("Тест МосЭнергоСбыт: ошибка подготовки JSON:", e);
//       message.error("Тест МосЭнергоСбыт: ошибка подготовки JSON");
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
//         const jwt = localStorage.getItem("jwt");
//         const resp = await sendToEdds(URL, eddsPayload, jwt);
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
//         <Button onClick={handleTestMes} disabled={sending || !mesPayload}>
//           Тест МосЭнергоСбыт
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
