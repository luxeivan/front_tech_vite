import React from "react";
import { Button, Card, Col, Row, Select } from "antd";

export default function PesFiltersCard({
  branchOptions,
  branchFilter,
  setBranchFilter,
  poOptions,
  poFilter,
  setPoFilter,
  statusOptions,
  statusFilter,
  setStatusFilter,
  resetFilters,
}) {
  return (
    <Card size="small" style={{ marginBottom: 8 }} className="pes-card pes-card--filters">
      <Row gutter={[8, 8]}>
        <Col xs={24} md={7}>
          <Select
            size="small"
            placeholder="Филиал"
            options={branchOptions}
            value={branchFilter}
            onChange={(v) => {
              setBranchFilter(v);
              setPoFilter("__all__");
            }}
            style={{ width: "100%" }}
          />
        </Col>
        <Col xs={24} md={7}>
          <Select
            size="small"
            placeholder="ПО"
            options={poOptions}
            value={poFilter}
            onChange={setPoFilter}
            style={{ width: "100%" }}
          />
        </Col>
        <Col xs={24} md={7}>
          <Select
            size="small"
            placeholder="Статус"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            style={{ width: "100%" }}
          />
        </Col>
        <Col xs={24} md={3}>
          <Button size="small" block onClick={resetFilters}>Сбросить</Button>
        </Col>
      </Row>
    </Card>
  );
}
