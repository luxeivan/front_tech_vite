

import React from "react";
import { Modal, Alert, List, Space, Typography, Skeleton, message } from "antd";
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
  const { getJwt, getUserMe } = useAuth((s) => s);
  const [lines, setLines] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const loadJournal = React.useCallback(async () => {
    try {
      setLoading(true);
      await getUserMe?.(); // чтобы в сторе был свежий user/jwt
      const jwt = getJwt?.();
      const base = import.meta.env.VITE_URL_BACKEND;
      const url =
        `${base}/api/zhurnal-otpravkis` +
        `?pagination[page]=1&pagination[pageSize]=1&sort[0]=updatedAt:desc`;

      const r = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error?.message || "Не удалось получить журнал");
      }

      const arr = Array.isArray(data?.data) && data.data.length > 0
        ? data.data[0]?.data
        : [];

      // Стравниваем и сортируем: от свежих к старым (сверху вниз)
      const prepared = Array.isArray(arr) ? [...arr] : [];
      prepared.sort((a, b) => parseDateFromLine(b) - parseDateFromLine(a));
      setLines(prepared);
    } catch (e) {
      console.log("[journalModal] load error", e);
      message.error(
        e?.message || "Ошибка загрузки журнала. Попробуйте обновить страницу."
      );
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [getJwt, getUserMe]);

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
              renderItem={(item, idx) => (
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