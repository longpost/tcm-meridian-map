"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import InlineSvg, { type SvgMeta } from "./InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type ExtraId, type MapShape } from "../lib/meridianMap";

type Mode = "twelve" | "extra";
const BUILD_ID = "MeridianPanel_BUILD_2025-12-31_003"; // ✅ 你线上必须能看到它

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
  const pathname = usePathname() || "";
  const isMapperRoute = pathname.startsWith("/mapper");

  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";
  const ids = mode === "twelve" ? TWELVE : EXTRA;

  // ✅ 只要在 /mapper：强制 admin
  const [admin, setAdmin] = useState<boolean>(isMapperRoute);

  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");
  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);
  const [meta, setMeta] = useState<SvgMeta | null>(null);
  const [loaded, setLoaded] = useState(false);

  // ✅ 预览流动（点击线段时短预览）
  const [previewSegKeys, setPreviewSegKeys] = useState<string[]>([]);
  const previewTimer = useRef<number | null>(null);
  const clearPreview = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    setPreviewSegKeys([]);
  };
  const startPreview = (keys: string[], ms = 900) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    setPreviewSegKeys(keys);
    previewTimer.current = window.setTimeout(() => setPreviewSegKeys([]), ms);
  };

  // ✅ 自检：你点线段到底有没有命中
  const [lastPick, setLastPick] = useState<string>("");

  // 读 localStorage
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

  // 写回（读完才写）
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(svgPath), JSON.stringify(draftMap));
    } catch {}
  }, [draftMap, svgPath, loaded]);

  // ✅ /mapper 强制 admin，不让你点着点着又跑回 view
  useEffect(() => {
    if (isMapperRoute) setAdmin(true);
  }, [isMapperRoute]);

  const bucketSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  const activeSegKeys = useMemo(() => {
    return previewSegKeys.length ? previewSegKeys : bucketSegKeys;
  }, [previewSegKeys, bucketSegKeys]);

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    setLastPick(segKey);
    startPreview([segKey], 900);

    if (admin) {
      // ✅ 映射：加/减当前桶
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

    // view：点线联动按钮
    const mapObj = mode === "twelve" ? draftMap.twelve : draftMap.extra;
    const hit = reverseLookup(mapObj as any, segKey);
    if (hit) {
      if (mode === "twelve") setSelectedTwelve(hit as TwelveId);
      else setSelectedExtra(hit as ExtraId);
    }
  };

  const hardReset = () => {
    try { localStorage.removeItem(storageKey(svgPath)); } catch {}
    clearPreview();
    setLastPick("");
    setDraftMap(MERIDIAN_MAP);
    alert("已重置并清空本地映射。");
  };

  // ✅ Auto-map（按颜色）——只要在 /mapper 就必须显示
  const autoMapByColor = () => {
    if (mode !== "twelve") {
      alert("Auto-map 目前只对 12经这张图做。");
      return;
    }
    if (!meta || meta.segments.length === 0) {
      alert("SVG 还没加载好（meta.segments=0），等 1 秒再点。");
      return;
    }

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

    // 稳定分配：按左右 6+6，再按 y 排
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

    alert("已生成 12 组初稿。现在点 LU/LI… 再点线段即可加/减修正。");
  };

  // ✅ 在 mapper 强制显示工具栏
  const showTools = isMapperRoute || admin;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 12 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff", overflow: "hidden" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? bucketSegKeys : []}
          onPickSeg={onPickSeg}
          onMeta={setMeta}
        />
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        {/* ✅ 你线上必须看到 BUILD_ID，否则你没部署对 */}
        <div style={{ padding: 10, borderRadius: 12, border: "2px solid #111", background: "#fafafa", fontWeight: 900 }}>
          {BUILD_ID}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            route: <code>{pathname || "?"}</code><br />
            svg: <code>{svgPath}</code><br />
            admin: <b>{String(admin)}</b> / mapperRoute: <b>{String(isMapperRoute)}</b><br />
            segments: <b>{meta?.segments?.length ?? "?"}</b><br />
            lastPick: <code style={{ fontSize: 11 }}>{lastPick || "（无）"}</code>
          </div>
        </div>

        {!isMapperRoute ? (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => { clearPreview(); setAdmin((v) => !v); }}
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
        ) : null}

        {showTools ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "twelve" ? (
              <button
                onClick={autoMapByColor}
                style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
              >
                Auto-map（生成映射）
              </button>
            ) : null}

            <button
              onClick={hardReset}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #f2c1c1", background: "#fff6f6", fontWeight: 900 }}
            >
              重置（清空）
            </button>

            <button
              onClick={() => {
                const txt = exportJson(draftMap);
                navigator.clipboard?.writeText(txt);
                alert("已复制映射 JSON");
              }}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
            >
              导出映射
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(6, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
          {ids.map((id) => {
            const on = currentId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  clearPreview(); // ✅ 不再“闪一下”
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

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          当前选中：<code>{currentId}</code>｜当前桶线段数：<b>{bucketSegKeys.length}</b>
        </div>
      </div>
    </div>
  );
}
