import React from "react";
import { Modal, Alert, List, Space, Tag, Typography, Skeleton, message } from "antd";
import axios from "axios";

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

// "№423 - guid - 27.10.2026 15:30:00 - канал - сообщение" → части строки
function parseJournalLine(line) {
  if (!line || typeof line !== "string") return null;
  const m = line.match(/^(.*?)\s-\s(\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2}:\d{2})\s-\s(.*)$/);
  if (!m) return null;
  const rest = m[3];
  const sep = rest.indexOf(" - ");
  return {
    head: m[1].trim(),
    date: m[2],
    channel: (sep >= 0 ? rest.slice(0, sep) : rest).trim(),
    message: sep >= 0 ? rest.slice(sep + 3).trim() : "",
  };
}

function channelColor(channel) {
  if (channel === "Автоотправка") return "purple";
  if (channel.includes("авто, создание")) return "orange";
  if (channel.includes("авто, обновление")) return "blue";
  return "default";
}

export default function JournalOpenModal({ open, onClose, journalIndex = 0 }) {
  const [lines, setLines] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const loadJournal = React.useCallback(async () => {
    try {
      setLoading(true);

      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;

      const params = {
        'pagination[page]': 1,
        'pagination[pageSize]': 10,
        'sort[0]': 'createdAt:asc',
      };

      const { data: payload } = await axios.get(url, { params });

      const items = Array.isArray(payload?.data) ? payload.data : [];
      const target = items[journalIndex] ?? null;
      let arr = [];
      if (target) {
        const d = target?.attributes?.data ?? target?.data ?? [];
        if (Array.isArray(d)) arr = d.slice();
        else if (typeof d === "string") arr = d.split(/\r?\n/).filter(Boolean);
      }

      const prepared = Array.isArray(arr) ? [...arr] : [];
      prepared.sort((a, b) => parseDateFromLine(b) - parseDateFromLine(a));
      setLines(prepared);

      // console.log("[journalModal] loaded entries (index %d):", journalIndex, Array.isArray(prepared) ? prepared.length : 0);
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
      // console.log("[journalModal] load error", e);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [journalIndex]);

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
          description="Свежие записи выше. Оранжевый — автоотправка при создании ТН, синий — при обновлении (PUT), фиолетовый — переключение автоотправки, серый — ручная отправка."
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
              renderItem={(item) => {
                const p = parseJournalLine(item);
                if (!p) {
                  return (
                    <List.Item>
                      <Text style={{ whiteSpace: "pre-wrap" }}>{item}</Text>
                    </List.Item>
                  );
                }
                return (
                  <List.Item>
                    <Space
                      direction="vertical"
                      size={2}
                      style={{ width: "100%", whiteSpace: "pre-wrap" }}
                    >
                      <Space size={8} wrap>
                        <Tag color={channelColor(p.channel)} style={{ marginInlineEnd: 0 }}>
                          {p.channel}
                        </Tag>
                        <Text type="secondary">{p.date}</Text>
                        {/\d|[0-9a-f]{8}-[0-9a-f]{4}/i.test(p.head) ? (
                          <Text type="secondary">{p.head}</Text>
                        ) : null}
                      </Space>
                      {p.message ? <Text>{p.message}</Text> : null}
                    </Space>
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </Space>
    </Modal>
  );
}
