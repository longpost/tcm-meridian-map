"use client";

import React, { useMemo, useState } from "react";
import InlineSvg from "./InlineSvg";

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const [active, setActive] = useState<string | null>("G01");

  // 这张 SVG 里我聚类出来 8 组（稳定可点）
  const groups = useMemo(
    () => [
      { id: "G01", name: "经络组 G01" },
      { id: "G02", name: "经络组 G02" },
      { id: "G03", name: "经络组 G03" },
      { id: "G04", name: "经络组 G04" },
      { id: "G05", name: "经络组 G05" },
      { id: "G06", name: "经络组 G06" },
      { id: "G07", name: "经络组 G07" },
      { id: "G08", name: "经络组 G08" },
    ],
    []
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activeGroup={active}
          onPickGroup={(g) => setActive(g)}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          ✅ 现在：只能点到彩色经络线；人体轮廓/黑灰线完全点不到。点线会联动右侧按钮。
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>选择经络组</div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {groups.map((g) => {
            const on = g.id === active;
            return (
              <button
                key={g.id}
                onClick={() => setActive(g.id)}
                style={{
                  cursor: "pointer",
                  borderRadius: 10,
                  padding: "10px 10px",
                  border: on ? "2px solid #111" : "1px solid #ddd",
                  background: on ? "#111" : "#fafafa",
                  color: on ? "#fff" : "#111",
                  fontWeight: 900,
                }}
              >
                {g.id}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, borderTop: "1px dashed #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900 }}>当前选中</div>
          <div style={{ marginTop: 6 }}>
            <code>{active ?? "（未选择）"}</code>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            这张 SVG 原文件不是“12 条经络各自独立分组”的结构，所以我先把它改成：
            <br />
            1) 韩文全删；2) 人体轮廓不可点；3) 彩色线可点；4) 稳定分组。
            <br />
            你要 LU/LI/ST… 12 个按钮精准对应：必须换一个本身就按经络分层/分组的 SVG，
            或者你告诉我 “G01=LU, G02=LI …” 我再把映射写死到 SVG 里（就能 12 按钮）。
          </div>
        </div>
      </div>
    </div>
  );
}



