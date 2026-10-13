import { Flex, Switch, Tooltip, Typography } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useState } from "react";

export default function AutoSendSwitch({ defaultChecked = false, onChange }) {
  const [checked, setChecked] = useState(defaultChecked);

  const handleToggle = () => {
    const next = !checked;
    setChecked(next);
    onChange?.(next);
  };

  return (
    <>
      <style>{`
        .tn-autosend {
          padding: 3px 10px 3px 8px;
          border-radius: 999px;
          border: 1px solid #f0f0f0;
          background: #fafafa;
          cursor: pointer;
          transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
          user-select: none;
          white-space: nowrap;
        }
        .tn-autosend:hover {
          border-color: #d9d9d9;
        }
        .tn-autosend.is-on {
          border-color: #b7eb8f;
          background: #f6ffed;
          box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.08);
        }
        .tn-autosend__dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #bfbfbf;
          transition: background 0.25s ease, box-shadow 0.25s ease;
        }
        .tn-autosend.is-on .tn-autosend__dot {
          background: #52c41a;
          animation: tnAutosendPulse 1.8s ease-in-out infinite;
        }
        .tn-autosend .ant-switch.ant-switch-checked {
          background: #52c41a;
        }
        .tn-autosend .ant-switch.ant-switch-checked:hover {
          background: #73d13d;
        }
        @keyframes tnAutosendPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.18); }
          50% { box-shadow: 0 0 0 5px rgba(82, 196, 26, 0.08); }
        }
      `}</style>
      <Tooltip title={checked ? "Автоотправка включена" : "Автоотправка выключена"}>
        <Flex
          align="center"
          gap={8}
          className={`tn-autosend${checked ? " is-on" : ""}`}
          onClick={handleToggle}
        >
          <span className="tn-autosend__dot" />
          <Typography.Text
            strong
            style={{
              whiteSpace: "nowrap",
              color: checked ? "#389e0d" : "#8c8c8c",
              transition: "color 0.25s ease",
            }}
          >
            Автоотправка
          </Typography.Text>
          <span onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={checked}
              onChange={handleToggle}
              checkedChildren={<CheckOutlined />}
              unCheckedChildren={<CloseOutlined />}
              aria-label="Автоотправка"
            />
          </span>
        </Flex>
      </Tooltip>
    </>
  );
}
