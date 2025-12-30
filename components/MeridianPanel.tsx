"use client";

import React, { useMemo, useState } from "react";
import InlineSvg, { type SvgMeta } from "./InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type ExtraId, type MapShape } from "../lib/meridianMap";

type Mode = "twelve" | "extra";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];
const EXTRA: ExtraId[] = ["REN","DU","CHONG","DAI","YINWEI","YANGWEI","YINQIAO","YANGQIAO"];

function isTwelveMode(svgPath: string): boolean {
  return svgPath.includes("12meridians12shichen");
}

function reverseLookup(map: Record<string, string[]>, segKey: string): string | null {
  for (const [k, arr] of Object.entries(map)) {
    if (arr.includes(segKey)) return k;
  }
  return null;
}

function exportJson(obj: MapShape) {
  return JSON.stringify(obj, null, 2);
}

// ✅ 韩文关键词 → 12经（按图例常见写法）
const KO_TO_TWELVE: Array<{ id: TwelveId; keys: string[] }> = [
  { id: "LU", keys: ["폐", "폐경"] },
  { id: "LI", keys: ["대장", "대장경"] },
  { id: "ST", keys: ["위", "위경"] },
  { id: "SP", keys: ["비", "비경"] },
  { id: "HT", keys: ["심", "심경"] },
  { id: "SI", keys: ["소장", "소장경"] },
  { id: "BL", keys: ["방광", "방광경"] },
  { id: "KI", keys: ["신", "신경"] },
  { id: "PC", keys: ["심포", "심포경"] },
  { id: "SJ", keys: ["삼초", "삼초경"] },
  { id: "GB", keys: ["담", "담경"] },
  { id: "LR", keys: ["간", "간경"] },
];

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";
  const [admin, setAdmin] = useState(false);

  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);

  const [meta, setMeta] = useState<SvgMeta | null>(null);

  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const activeSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  const draftSegKeys = useMemo(() => {
    if (!admin) return [];
    return activeSegKeys;
  }, [admin, activeSegKeys]);

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    if (admin) {
      setDraftMap((prev) => {
        const next: MapShape = JSON.parse(JSON.stringify(prev));
        const bucket = mode === "twelve"
          ? (next.twelve[currentId as TwelveId] ||= [])
          : (next.extra[currentId as ExtraId] ||= []);
        const idx = bucket.indexOf(segKey);
        if (idx >= 0) bucket.splice(idx, 1);
        else bucket.push(segKey);
        return next;
      });
      return;
    }

    const mapObj = mode === "twelve" ? draftMap.twelve : draftMap.extra;
    const hit = reverseLookup(mapObj as any, segKey);
    if (hit) {
      if (mode === "twelve") setSelectedTwelve(hit as TwelveId);
      else setSelectedExtra(hit as ExtraId);
    }
  };

  const ids = mode === "twelve" ? TWELVE : EXTRA;

  const doAutoMapTwelve = () => {
    if (!meta) {
      alert("SVG 还没加载完（meta为空），等1秒再点。");
      return;
    }
    if (mode !== "twelve") {
      alert("Auto-map 初稿目前只做 12经（twelve 图）。");
      return;
    }

    // 1) 找到每条经的“标签锚点”（图例文字中心）
    const anchors: Array<{ id: TwelveId; cx: number; cy: number }> = [];
    for (const rule of KO_TO_TWELVE) {
      const hit = meta.labels.find((l) => rule.keys.some((k) => l.text.includes(k)));
      if (hit) anchors.push({ id: rule.id, cx: hit.cx, cy: hit.cy });
    }

    if (anchors.length < 6) {
      alert("没找到足够的韩文图例标签（anchors太少）。这张图可能图例文字被删了或不同写法。");
      return;
    }

    // 2) 每个线段分配给最近的锚点
    const next: MapShape = JSON.parse(JSON.stringify(draftMap));
    // 先清空
    for (const id of TWELVE) next.twelve[id] = [];

    for (const s of meta.segments) {
      let best: { id: TwelveId; d2: number } | null = null;
      for (const a of anchors) {
        const dx = s.cx - a.cx;
        const dy = s.cy - a.cy;
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) best = { id: a.id, d2 };
      }
      if (best) next.twelve[best.id].push(s.segKey);
    }

    setDraftMap(next);
    alert("已生成 12经 Auto-map 初稿。你现在逐个经络点按钮检查，错误的段手工点掉/补上即可。");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? draftSegKeys : []}
          onPickSeg={onPickSeg}
          onMeta={setMeta}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          {admin
            ? "【映射模式】点线段：加入/移除当前经络。完成后导出 JSON 固化到 lib/meridianMap.ts。"
            : "点线段会反选右侧按钮（前提：线段已被映射）。"}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "12经络" : "任督 + 奇经八脉"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              {mode === "twelve" ? "LU/LI/ST… 映射到线段集合" : "REN/DU/CHONG… 映射到线段集合"}
            </div>
          </div>

          <button
            onClick={() => setAdmin((v) => !v)}
            style={{
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 10,
              border: admin ? "2px solid #111" : "1px solid #ddd",
              background: admin ? "#111" : "#fafafa",
              color: admin ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            {admin ? "退出映射" : "进入映射"}
          </button>
        </div>

        {admin && mode === "twelve" ? (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={doAutoMapTwelve}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fafafa",
                fontWeight: 900,
              }}
            >
              Auto-map 初稿（12经）
            </button>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
              用图例韩文经络名当锚点，按“线段中心点离哪个锚点最近”自动分配。肯定会有错，但能省掉你从0开始的体力活。
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 8 }}>
          {ids.map((id) => {
            const on = currentId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (mode === "twelve") setSelectedTwelve(id as TwelveId);
                  else setSelectedExtra(id as ExtraId);
                }}
                style={{
                  cursor: "pointer",
                  borderRadius: 10,
                  padding: "8px 10px",
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

        <div style={{ marginTop: 14, borderTop: "1px dashed #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>当前选中</div>
          <div><code>{currentId}</code></div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            线段数：<b>{activeSegKeys.length}</b>
          </div>

          {admin ? (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => {
                  const txt = exportJson(draftMap);
                  navigator.clipboard?.writeText(txt);
                  alert("已复制映射 JSON（也会显示在下方文本框）");
                }}
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  fontWeight: 900,
                }}
              >
                导出映射（复制到剪贴板）
              </button>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                把下面 JSON 粘贴覆盖到 <code>lib/meridianMap.ts</code> 的 <code>MERIDIAN_MAP</code>。
              </div>

              <textarea
                readOnly
                value={exportJson(draftMap)}
                style={{
                  marginTop: 8,
                  width: "100%",
                  height: 220,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  padding: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

