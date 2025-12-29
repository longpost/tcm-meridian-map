"use client";

import React from "react";
import { MERIDIANS, MeridianId } from "../lib/meridians";


export default function MeridianPanel({
  pickedStroke,
}: {
  pickedStroke?: string;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>科普说明</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
        本页面仅用于科普学习，不构成诊断或治疗建议。
      </div>

      <div style={{ marginTop: 12, fontWeight: 800 }}>你刚点到的线</div>
      <div style={{ marginTop: 6 }}>
        Stroke 颜色：<code>{pickedStroke ?? "（未选择）"}</code>
      </div>

      <div style={{ marginTop: 12, fontWeight: 800 }}>经络列表（文案占位）</div>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {MERIDIANS.map((m) => (
          <div key={m.id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ fontWeight: 800 }}>{m.id} · {m.zh} <span style={{ opacity: 0.7, fontWeight: 500 }}>({m.en})</span></div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{m.blurb}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
