import React from "react";
import { Alert, Button, Card, Col, Divider, Input, Row, Select, Space, Typography } from "antd";

const { Text } = Typography;

export default function PesCommandCard({
  mode,
  selectedCount,
  sending,
  destinationType,
  setDestinationType,
  destinationId,
  setDestinationId,
  destinationOptions,
  tpBranchFilter,
  setTpBranchFilter,
  tpPoFilter,
  setTpPoFilter,
  tpBranchOptions,
  tpPoOptions,
  comment,
  setComment,
  actionState,
  runAction,
}) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} className="pes-card pes-card--command">
      <Space direction="vertical" style={{ width: "100%" }} size={6}>
        <Text strong>
          Команда на ПЭС ({mode === "multi" ? "множественный" : "одиночный"} выбор), выбрано: {selectedCount}
        </Text>

        {/* <Alert
          className="pes-help-alert"
          type="info"
          showIcon
          message="Как работать: 1) выберите ПЭС кликом по плиткам, 2) выберите точку назначения, 3) нажмите нужную кнопку операции. Комментарий отправляется вместе с командой."
        /> */}

        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Select
              size="small"
              value={destinationType}
              onChange={setDestinationType}
              disabled={mode === "multi" || sending}
              options={[
                { value: "assembly", label: "Точка сбора ПЭС" },
                { value: "tp", label: "ТП (только одиночный выбор)" },
              ]}
              style={{ width: "100%" }}
            />
          </Col>
          {destinationType === "tp" ? (
            <>
              <Col xs={24} md={5}>
                <Select
                  size="small"
                  value={tpBranchFilter}
                  onChange={(v) => {
                    setTpBranchFilter(v);
                    setTpPoFilter("__all__");
                    setDestinationId(undefined);
                  }}
                  options={tpBranchOptions}
                  placeholder="Филиал"
                  disabled={sending}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col xs={24} md={5}>
                <Select
                  size="small"
                  showSearch
                  optionFilterProp="label"
                  value={tpPoFilter}
                  onChange={(v) => {
                    setTpPoFilter(v);
                    setDestinationId(undefined);
                  }}
                  options={tpPoOptions}
                  placeholder="ПО"
                  disabled={sending}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col xs={24} md={6}>
                <Select
                  size="small"
                  showSearch
                  value={destinationId}
                  onChange={setDestinationId}
                  options={destinationOptions}
                  placeholder="ТП"
                  optionFilterProp="label"
                  disabled={sending}
                  style={{ width: "100%" }}
                />
              </Col>
            </>
          ) : (
            <Col xs={24} md={16}>
              <Select
                size="small"
                showSearch
                value={destinationId}
                onChange={setDestinationId}
                options={destinationOptions}
                placeholder="Точка назначения"
                optionFilterProp="label"
                disabled={sending}
                style={{ width: "100%" }}
              />
            </Col>
          )}
        </Row>

        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 2 }}
          placeholder="Комментарий к операции (уйдет в уведомление Telegram)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={sending}
          className="pes-command-comment"
        />

        <Space wrap>
          <Button
            size="small"
            type="primary"
            onClick={() => runAction("dispatch")}
            loading={sending}
            disabled={actionState("dispatch").disabled || sending}
            title={actionState("dispatch").reason}
          >
            Команда на выезд
          </Button>
          <Button
            size="small"
            onClick={() => runAction("reroute")}
            loading={sending}
            disabled={actionState("reroute").disabled || sending}
            title={actionState("reroute").reason}
          >
            Корректировка маршрута
          </Button>
          <Button
            size="small"
            onClick={() => runAction("cancel")}
            loading={sending}
            disabled={actionState("cancel").disabled || sending}
            title={actionState("cancel").reason}
          >
            Отмена выезда
          </Button>
          <Divider type="vertical" />
          <Button
            size="small"
            onClick={() => runAction("depart")}
            loading={sending}
            disabled={actionState("depart").disabled || sending}
            title={actionState("depart").reason}
          >
            Фактический выезд
          </Button>
          <Button
            size="small"
            onClick={() => runAction("connect")}
            loading={sending}
            disabled={actionState("connect").disabled || sending}
            title={actionState("connect").reason}
          >
            Подключена
          </Button>
          <Button
            size="small"
            onClick={() => runAction("ready")}
            loading={sending}
            disabled={actionState("ready").disabled || sending}
            title={actionState("ready").reason}
          >
            Вернуть в резерв
          </Button>
          <Button
            size="small"
            onClick={() => runAction("repair")}
            loading={sending}
            disabled={actionState("repair").disabled || sending}
            title={actionState("repair").reason}
          >
            В ремонт
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
