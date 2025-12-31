"use client";

import React, { useMemo, useState } from "react";
import InlineSvg from "../../components/InlineSvg";
import { MERIDIAN_MAP, type TwelveId } from "../../lib/meridianMap";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

export default function ViewerPage() {
  const [selected, setSelected] = useState<TwelveId>("LU");

  const svgPath = "/assets/12meridians12shichen.svg";

  const activeSegKeys = useMemo(() => {
    return MERIDIAN_MAP.twelve[selected] || [];
  }, [selected]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Viewer（科普展示）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            点按钮高亮经络。点线段会反查并选中对应按钮（前提：该线段已映射）。
          </div>
        </div>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {TWELVE.map((id) => {
          const on = id === selected;
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              style={{
                cursor: "pointer",
                padding: "10px 10px",
                borderRadius: 12,
                border: on ? "2px solid #111" : "1px solid #ddd",
                background: on ? "#111" : "#fafafa",
                color: on ? "#fff" : "#111",
                fontWeight: 900,
              }}
            >
              {id}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          onPickSeg={({ segKey }) => {
            // 反查：点到哪个经就选中哪个
            const hit = reverseLookup(MERIDIAN_MAP.twelve as any, segKey);
            if (hit) setSelected(hit as TwelveId);
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        当前经络线段数：<b>{activeSegKeys.length}</b>
      </div>
    </main>
  );
}

function reverseLookup(map: Record<string, string[]>, segKey: string): string | null {
  for (const [k, arr] of Object.entries(map)) {
    if (arr.includes(segKey)) return k;
  }
  return null;
}
