import React from "react";
import { Modal, Alert, List, Space, Typography, Skeleton, message } from "antd";
import axios from "axios";
import useAuth from "../../stores/useAuth";

const { Text } = Typography;

function parseDateFromLine(line) {
  if (!line || typeof line !== "string") return 0;
  // ожидаем формат: "№123 - GUID - 08.10.2025 09:04:13 - ЕДДС - ..."
  const m = line.match(/-\s(\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2})\s-/);
  if (!m) return 0;
  const [dd, mm, yyyy, hh, min, ss] = m[1]
    .replace(/\./g, " ")
    .replace(/:/g, " ")
    .split(" ")
    .map(Number);
  // Локальное время (МСК у нас уже в строке). Создаём дату без смещения.
  const d = new Date(yyyy, mm - 1, dd, hh, min, ss);
  return d.getTime();
}

export default function JournalOpenModal({ open, onClose }) {
  const { getUserMe } = useAuth((s) => s);
  const [lines, setLines] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const loadJournal = React.useCallback(async () => {
    try {
      setLoading(true);

      // Обновим пользователя/сессию (интерцептор сам подмешает JWT)
      await getUserMe?.();

      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;

      // В axios корректно сериализуем вложенные параметры в стиле Strapi
      const params = {
        'pagination[page]': 1,
        'pagination[pageSize]': 1,
        'sort[0]': 'updatedAt:desc',
      };

      const { data: payload } = await axios.get(url, { params });

      // Strapi v4: item has shape { id, attributes: { data: [...] } }
      const firstItem = Array.isArray(payload?.data) && payload.data.length > 0 ? payload.data[0] : null;
      let arr = firstItem?.attributes?.data ?? firstItem?.data ?? [];

      // Если бэк отдал строку ("one per line"), превратим в массив
      if (!Array.isArray(arr) && typeof arr === "string") {
        arr = arr.split(/\r?\n/).filter(Boolean);
      }

      const prepared = Array.isArray(arr) ? [...arr] : [];
      prepared.sort((a, b) => parseDateFromLine(b) - parseDateFromLine(a));
      setLines(prepared);

      console.log("[journalModal] loaded entries:", Array.isArray(prepared) ? prepared.length : 0);
    } catch (e) {
      const status = e?.response?.status;
      const backendMsg = e?.response?.data?.error?.message;
      if (status === 401) {
        message.warning("Сессия истекла. Войдите снова.");
      } else if (status === 403) {
        message.error("Недостаточно прав для чтения журнала (403). Проверьте роли/permissions в Strapi.");
      } else {
        message.error(backendMsg || e?.message || "Ошибка загрузки журнала. Попробуйте обновить страницу.");
      }
      console.log("[journalModal] load error", e);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [getUserMe]);

  React.useEffect(() => {
    if (open) loadJournal();
  }, [open, loadJournal]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      maskClosable={false}
      keyboard
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Журнал отправки"
          description="Последние операции отправки в ЕДДС/МЭС. Свежие записи выше."
        />

        <div style={{ maxHeight: "60vh", overflow: "auto" }}>
          {loading ? (
            <>
              <Skeleton active title paragraph={{ rows: 3 }} />
              <Skeleton active title paragraph={{ rows: 3 }} />
            </>
          ) : lines.length === 0 ? (
            <Alert type="warning" showIcon message="Журнал пуст" />
          ) : (
            <List
              size="small"
              bordered
              dataSource={lines}
              renderItem={(item) => (
                <List.Item>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{item}</Text>
                </List.Item>
              )}
            />
          )}
        </div>
      </Space>
    </Modal>
  );
}