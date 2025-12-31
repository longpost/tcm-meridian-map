"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // ✅ 关键：避免“读完之前就写回覆盖”
  const [loaded, setLoaded] = useState(false);

  // ✅ 预览流动（点线就立刻流动，方便你检查）
  const [previewSegKeys, setPreviewSegKeys] = useState<string[]>([]);
  const previewTimer = useRef<number | null>(null);

  // ✅ Debug：显示最后点到的 segKey（用来判断到底有没有触发 click）
  const [lastPick, setLastPick] = useState<string>("");

  // 1) 读 localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(svgPath));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) setDraftMap(parsed);
      }
    } catch {}
    setLoaded(true);
  }, [svgPath]);

  // 2) 读完才写回
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(svgPath), JSON.stringify(draftMap));
    } catch {}
  }, [draftMap, svgPath, loaded]);

  // 当前桶
  const bucketSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  // mapper/view 都用同一套 “activeSegKeys” 来触发流动：
  // - 如果刚点线段，先预览那条线
  // - 否则流动当前桶
  const activeSegKeys = useMemo(() => {
    return previewSegKeys.length ? previewSegKeys : bucketSegKeys;
  }, [previewSegKeys, bucketSegKeys]);

  const startPreview = (keys: string[]) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    setPreviewSegKeys(keys);
    previewTimer.current = window.setTimeout(() => setPreviewSegKeys([]), 800);
  };

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    setLastPick(segKey);
    startPreview([segKey]); // ✅ 不管啥模式，先让它动起来，便于确认你点到了什么

    if (admin) {
      // ✅ 映射模式：加入/移除当前桶
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

    // 浏览模式：点线联动按钮
    const mapObj = mode === "twelve" ? draftMap.twelve : draftMap.extra;
    const hit = reverseLookup(mapObj as any, segKey);
    if (hit) {
      if (mode === "twelve") setSelectedTwelve(hit as TwelveId);
      else setSelectedExtra(hit as ExtraId);
    }
  };

  const hardReset = () => {
    try {
      localStorage.removeItem(storageKey(svgPath));
    } catch {}
    setDraftMap(MERIDIAN_MAP);
    setLastPick("");
    setPreviewSegKeys([]);
    alert("已清空本 SVG 的本地映射（localStorage）。");
  };

  // ✅ Auto-map（按颜色）——清空后还能重新生成
  const autoMapByColor = () => {
    if (mode !== "twelve") {
      alert("Auto-map 目前只对 12经这张图做。");
      return;
    }
    if (!meta || meta.segments.length === 0) {
      alert("图还没加载完（meta 为空），等一下再点。");
      return;
    }

    // segments 里必须有 stroke（InlineSvg 负责提供）
    const hasStroke = meta.segments.some((s: any) => !!(s as any).stroke);
    if (!hasStroke) {
      alert("当前 InlineSvg 没有回传 stroke 颜色，无法按颜色自动分组。请先换回带 stroke 的 InlineSvg。");
      return;
    }

    // 颜色 -> segKeys
    const colorBuckets = new Map<string, string[]>();
    for (const s of meta.segments as any[]) {
      const c = normColor(s.stroke || "");
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

    // 计算每个颜色桶中心点（近似用于排序稳定）
    const segPos = new Map((meta.segments as any[]).map((s) => [s.segKey, s]));
    const groups = top.map((g) => {
      let sx = 0, sy = 0, cnt = 0;
      for (const k of g.segKeys) {
        const p = segPos.get(k);
        if (!p) continue;
        sx += p.cx; sy += p.cy; cnt++;
      }
      return { ...g, cx: cnt ? sx / cnt : 0, cy: cnt ? sy / cnt : 0 };
    });

    // 稳定分配：按左右分 6+6 再各自按 y 排
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

    alert("已生成 12 组初稿。现在进入映射模式，逐个按钮检查，点线段增删修正即可。");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
      {/* 左：图 */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff", overflow: "hidden" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? bucketSegKeys : []}
          onPickSeg={onPickSeg}
          onMeta={setMeta}
        />
      </div>

      {/* 右：控制 + 列表 */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "Mapper（12经）" : "Mapper（奇经）"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              loaded: <b>{String(loaded)}</b><br />
              可点线段总数: <b>{meta?.segments?.length ?? "?"}</b><br />
              最后点到: <code style={{ fontSize: 11 }}>{lastPick || "（无）"}</code>
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
              强制重置
            </button>
          </div>
        ) : admin ? (
          <div style={{ marginTop: 10 }}>
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
              强制重置
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(6, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
          {ids.map((id) => {
            const on = currentId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (mode === "twelve") setSelectedTwelve(id as TwelveId);
                  else setSelectedExtra(id as ExtraId);
                  // ✅ 选名称立即流动：activeSegKeys 会用 bucketSegKeys
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

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          当前选中：<code>{currentId}</code>｜当前桶线段数：<b>{bucketSegKeys.length}</b>
        </div>

        {/* 当前桶列表：你点线段加没加，一眼就知道 */}
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900 }}>当前桶 segKey 列表</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            映射模式：点线段 = 加/删；点完会预览流动 0.8 秒。
          </div>

          <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", border: "1px solid #eee", borderRadius: 12, padding: 8 }}>
            {bucketSegKeys.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>（空）</div>
            ) : (
              bucketSegKeys.map((k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                  <code style={{ fontSize: 11 }}>{k}</code>
                  {admin ? (
                    <button
                      onClick={() => {
                        setDraftMap((prev) => {
                          const next: MapShape = JSON.parse(JSON.stringify(prev));
                          const bucket = mode === "twelve"
                            ? (next.twelve[currentId as TwelveId] ||= [])
                            : (next.extra[currentId as ExtraId] ||= []);
                          const idx = bucket.indexOf(k);
                          if (idx >= 0) bucket.splice(idx, 1);
                          return next;
                        });
                        startPreview([k]);
                        setLastPick(k);
                      }}
                      style={{
                        cursor: "pointer",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: "#fafafa",
                        padding: "2px 8px",
                        fontWeight: 900,
                      }}
                    >
                      删
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
