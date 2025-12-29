"use client";

import React from "react";

export default function MeridianPanel({
  pickedStroke,
}: {
  pickedStroke?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 800 }}>选中信息</h2>

      <p style={{ fontSize: 13 }}>
        当前选中的经络线颜色：
        <br />
        <code>{pickedStroke ?? "（未选择）"}</code>
      </p>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        这是一个演示阶段的科普界面。下一步可以把颜色映射到
        LU / LI / ST 等经络并显示对应说明。
      </p>
    </div>
  );
}
