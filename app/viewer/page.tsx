"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg from "../../components/InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type MapShape } from "../../lib/meridianMap";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

const SVG_PATH = "/assets/12meridians12shichen.svg";
// 关键：必须和 mapper 用同一个 key
const STORAGE_KEY = `tcm_meridian_map::${SVG_PATH}`;

export default function ViewerPage() {
  const [map, setMap] = useState<MapShape>(MERIDIAN_MAP);
  const [selected, setSelected] = useState<TwelveId>("LU");

  // ✅ 从 mapper 保存的 localStorage 读取映射
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) setMap(parsed);
      }
    } catch {}
  }, []);

  const activeSegKeys = useMemo(() => {
    return map.twelve[selected] || [];
  }, [map, selected]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Viewer（科普展示）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            映射来源：优先读 mapper 保存的本地映射（localStorage）。如果你没在 mapper “导出/保存”，这里会是空。
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
          src={SVG_PATH}
          activeSegKeys={activeSegKeys}
          onPickSeg={({ segKey }) => {
            const hit = reverseLookup(map.twelve as any, segKey);
            if (hit) setSelected(hit as TwelveId);
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        当前经络线段数：<b>{activeSegKeys.length}</b>
        {activeSegKeys.length === 0 ? (
          <>
            {" "}（如果你已经在 mapper 点过映射但这里还是 0，说明 mapper 没写入 localStorage——见下方提示）
          </>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
        如果这里还是不行：去 <code>/mapper</code> 页面，点几条线让它流动一次，然后回来看这里（同一个浏览器、同一个域名）。
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
