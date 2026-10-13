import { Flex, Switch, Tooltip, Typography } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useState } from "react";

export default function AutoSendSwitch({ defaultChecked = false, onChange }) {
  const [checked, setChecked] = useState(defaultChecked);

  const handleToggle = (next) => {
    setChecked(next);
    onChange?.(next);
  };

  return (
    <Tooltip title={checked ? "Автоотправка включена" : "Автоотправка выключена"}>
      <Flex align="center" gap={8} style={{ whiteSpace: "nowrap" }}>
        <Typography.Text strong type={checked ? "success" : "secondary"}>
          Автоотправка
        </Typography.Text>
        <Switch
          checked={checked}
          onChange={handleToggle}
          checkedChildren={<CheckOutlined />}
          unCheckedChildren={<CloseOutlined />}
          aria-label="Автоотправка"
        />
      </Flex>
    </Tooltip>
  );
}
