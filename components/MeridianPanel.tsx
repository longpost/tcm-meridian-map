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
function storageKey(svgPath: string) {
  return `tcm_meridian_map::${svgPath}`;
}
function exportJson(obj: MapShape) {
  return JSON.stringify(obj, null, 2);
}
function reverseLookup(map: Record<string, string[]>, segKey: string): string | null {
  for (const [k, arr] of Object.entries(map)) if (arr.includes(segKey)) return k;
  return null;
}
function normColor(c: string) {
  return (c || "").trim().toLowerCase();
}

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";
  const ids = mode === "twelve" ? TWELVE : EXTRA;

  const [admin, setAdmin] = useState(false);
  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");
  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);
  const [meta, setMeta] = useState<SvgMeta | null>(null);

  // ✅ 关键修复：读本地映射完成之前，不允许写回（避免“重置不了/改不了”）
  const [loaded, setLoaded] = useState(false);

  // 1) 先读 localStorage（只做一次，读完标记 loaded）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(svgPath));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) {
          setDraftMap(parsed);
        }
      }
    } catch {}
    setLoaded(true);
  }, [svgPath]);

  // 2) 读完之后才自动保存
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(svgPath), JSON.stringify(draftMap));
    } catch {}
  }, [draftMap, svgPath, loaded]);

  const activeSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    // ✅ 映射模式：一定是“增删当前桶”，不走 reverseLookup
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

    // 浏览模式：点线反选按钮
    const mapObj = mode === "twelve" ? draftMap.twelve : draftMap.extra;
    const hit = reverseLookup(mapObj as any, segKey);
    if (hit) {
      if (mode === "twelve") setSelectedTwelve(hit as TwelveId);
      else setSelectedExtra(hit as ExtraId);
    }
  };

  // ✅ Auto-map：按颜色分组（不会塌成 BL/PC 两桶）
  const autoMapByColor = () => {
    if (mode !== "twelve") {
      alert("Auto-map 目前只做 12经这张图。");
      return;
    }
    if (!meta || meta.segments.length === 0) {
      alert("图还没加载完（meta为空），等一下再点。");
      return;
    }

    const colorBuckets = new Map<string, string[]>();
    for (const s of meta.segments) {
      const c = normColor((s as any).stroke || "");
      if (!c) continue;
      const arr = colorBuckets.get(c) || [];
      arr.push(s.segKey);
      colorBuckets.set(c, arr);
    }

    const top = Array.from(colorBuckets.entries())
      .map(([color, segKeys]) => ({ color, segKeys, n: segKeys.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    if (top.length < 8) {
      alert(`颜色桶太少（${top.length}），这张 SVG 可能不是按颜色区分经络。`);
      return;
    }

    // 给每个颜色桶算一个中心点（近似）
    const segPos = new Map(meta.segments.map((s: any) => [s.segKey, s]));
    const groups = top.map((g) => {
      let sx = 0, sy = 0, cnt = 0;
      for (const k of g.segKeys) {
        const p: any = segPos.get(k);
        if (!p) continue;
        sx += p.cx; sy += p.cy; cnt++;
      }
      return { ...g, cx: cnt ? sx / cnt : 0, cy: cnt ? sy / cnt : 0 };
    });

    // 稳定分配：按 cx 左右分 6+6，再各自按 cy 排
    const sorted = groups.slice().sort((a, b) => a.cx - b.cx);
    const left = sorted.slice(0, 6).sort((a, b) => a.cy - b.cy);
    const right = sorted.slice(6, 12).sort((a, b) => a.cy - b.cy);
    const merged = [...left, ...right];

    setDraftMap((prev) => {
      const next: MapShape = JSON.parse(JSON.stringify(prev));
      for (const id of TWELVE) next.twelve[id] = [];
      for (let i = 0; i < Math.min(12, merged.length); i++) {
        next.twelve[TWELVE[i]] = merged[i].segKeys.slice();
      }
      return next;
    });

    alert("已按颜色生成 12 组初稿。现在进映射模式逐个按钮检查，错的线段手工点掉/补上。");
  };

  const hardReset = () => {
    // ✅ 一刀切：清空本 SVG 的本地映射 + 回到默认
    try {
      localStorage.removeItem(storageKey(svgPath));
    } catch {}
    setDraftMap(MERIDIAN_MAP);
    alert("已清空本 SVG 的本地映射（localStorage）。");
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "12经络" : "任督 + 奇经八脉"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              loaded: <b>{String(loaded)}</b>（读完本地映射后才会自动保存，避免覆盖/锁死）
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

        {admin ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "twelve" ? (
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
            ) : null}

            <button
              onClick={hardReset}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #f2c1c1",
                background: "#fff6f6",
                fontWeight: 900,
              }}
            >
              强制重置（清空本地映射）
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
          当前选中：<code>{currentId}</code>，线段数：<b>{activeSegKeys.length}</b>，可点线段总数：<b>{meta?.segments?.length ?? "?"}</b>
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
