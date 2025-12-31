"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg, { type SvgMeta } from "./InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type ExtraId, type MapShape } from "../lib/meridianMap";

type Mode = "twelve" | "extra";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];
const EXTRA: ExtraId[] = ["REN","DU","CHONG","DAI","YINWEI","YANGWEI","YINQIAO","YANGQIAO"];

function isTwelveMode(svgPath: string): boolean {
  return svgPath.includes("12meridians12shichen");
}
function reverseLookup(map: Record<string, string[]>, segKey: string): string | null {
  for (const [k, arr] of Object.entries(map)) if (arr.includes(segKey)) return k;
  return null;
}
function exportJson(obj: MapShape) {
  return JSON.stringify(obj, null, 2);
}
function storageKey(svgPath: string) {
  return `tcm_meridian_map::${svgPath}`;
}
function normColor(c: string) {
  return (c || "").trim().toLowerCase();
}

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";

  const [admin, setAdmin] = useState(false);
  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);
  const [meta, setMeta] = useState<SvgMeta | null>(null);

  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;
  const ids = mode === "twelve" ? TWELVE : EXTRA;

  // 读/写 localStorage：保证 mapper/view/quiz 同步
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(svgPath));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) setDraftMap(parsed);
      }
    } catch {}
  }, [svgPath]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(svgPath), JSON.stringify(draftMap));
    } catch {}
  }, [draftMap, svgPath]);

  const activeSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

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

  // ✅ Auto-map（按 stroke 颜色分组）
  const autoMapByColor = () => {
    if (mode !== "twelve") {
      alert("Auto-map（按颜色）只用于 12经这张图。");
      return;
    }
    if (!meta || meta.segments.length === 0) {
      alert("图还没加载完，等一下再点。");
      return;
    }

    // 1) 颜色 -> segKeys
    const colorBuckets = new Map<string, string[]>();
    for (const s of meta.segments) {
      const c = normColor(s.stroke);
      if (!c) continue;
      const arr = colorBuckets.get(c) || [];
      arr.push(s.segKey);
      colorBuckets.set(c, arr);
    }

    // 2) 取最大的 12 个颜色桶（通常正好是 12 条经的颜色）
    const top = Array.from(colorBuckets.entries())
      .map(([color, segKeys]) => ({ color, segKeys, n: segKeys.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    if (top.length < 8) {
      alert(`颜色桶太少（${top.length}），这张 SVG 的经络可能不是按颜色区分。`);
      return;
    }

    // 3) 给每个颜色桶算一个中心点（用第一段 bbox center 的平均：近似够用）
    const segPos = new Map(meta.segments.map((s) => [s.segKey, s]));
    const groups = top.map((g) => {
      let sx = 0, sy = 0, cnt = 0;
      for (const k of g.segKeys) {
        const p = segPos.get(k);
        if (!p) continue;
        sx += p.cx; sy += p.cy; cnt++;
      }
      const cx = cnt ? sx / cnt : 0;
      const cy = cnt ? sy / cnt : 0;
      return { ...g, cx, cy };
    });

    // 4) 这里必须给出“自动对应 12 经”的规则。
    //    我先给你一个稳定初稿：按 (cx, cy) 排序，分成左/右两组各6，再各自按 cy 排。
    //    这不会再塌成 BL/PC 两桶，至少会得到 12 桶可用初稿，你再微调。
    const sorted = groups.sort((a, b) => a.cx - b.cx);
    const left = sorted.slice(0, 6).sort((a, b) => a.cy - b.cy);
    const right = sorted.slice(6, 12).sort((a, b) => a.cy - b.cy);

    // 5) 给 12 经一个默认顺序（你后面可以调整顺序，但不会再全进 BL/PC）
    const order: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];
    const merged = [...left, ...right];

    setDraftMap((prev) => {
      const next: MapShape = JSON.parse(JSON.stringify(prev));
      for (const id of TWELVE) next.twelve[id] = [];
      for (let i = 0; i < Math.min(12, merged.length); i++) {
        next.twelve[order[i]] = merged[i].segKeys.slice();
      }
      return next;
    });

    alert("已按颜色生成 12 组初稿。现在逐个点 LU/LI/ST… 检查，错的线段进映射模式手工修。");
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "12经络" : "任督 + 奇经八脉"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              关键：三个页面必须用同一个 <code>svgPath</code>，否则映射对不上。
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
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={autoMapByColor}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fafafa",
                fontWeight: 900,
              }}
            >
              Auto-map（按颜色，12组）
            </button>

            <button
              onClick={() => {
                if (!confirm("确认清空本 SVG 的本地映射？（会把 BL/PC 那种错误映射清掉）")) return;
                localStorage.removeItem(storageKey(svgPath));
                setDraftMap(MERIDIAN_MAP);
              }}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #f2c1c1",
                background: "#fff6f6",
                fontWeight: 900,
              }}
            >
              清空本 SVG 映射
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(6, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
          {ids.map((id) => {
            const on = currentId === id;
            return (
              <button
                key={id}
                onClick={() => (mode === "twelve" ? setSelectedTwelve(id as TwelveId) : setSelectedExtra(id as ExtraId))}
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

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          当前选中：<code>{currentId}</code>，线段数：<b>{activeSegKeys.length}</b>，
          可点线段总数：<b>{meta?.segments?.length ?? "?"}</b>
        </div>

        {admin ? (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                const txt = exportJson(draftMap);
                navigator.clipboard?.writeText(txt);
                alert("已复制映射 JSON");
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

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff", overflow: "hidden" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? activeSegKeys : []}
          onPickSeg={onPickSeg}
          onMeta={setMeta}
        />
      </div>
    </div>
  );
}
