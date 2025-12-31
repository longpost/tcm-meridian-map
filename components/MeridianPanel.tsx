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

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";
  const ids = mode === "twelve" ? TWELVE : EXTRA;

  const [admin, setAdmin] = useState(false);
  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");
  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);
  const [meta, setMeta] = useState<SvgMeta | null>(null);

  const [loaded, setLoaded] = useState(false);

  // ✅ 预览流动（用来点线段时立即看到）
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

  const bucketSegKeys = useMemo(() => {
    return mode === "twelve"
      ? (draftMap.twelve[selectedTwelve] || [])
      : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  const activeSegKeys = useMemo(() => {
    return previewSegKeys.length ? previewSegKeys : bucketSegKeys;
  }, [previewSegKeys, bucketSegKeys]);

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    // 点线段先预览一下，便于确认命中
    startPreview([segKey], 900);

    if (admin) {
      // 映射模式：加入/移除当前桶
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
    try { localStorage.removeItem(storageKey(svgPath)); } catch {}
    clearPreview();
    setDraftMap(MERIDIAN_MAP);
    alert("已清空本 SVG 的本地映射（localStorage）。");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "Mapper（12经）" : "Mapper（奇经）"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              可点线段总数：<b>{meta?.segments?.length ?? "?"}</b>
            </div>
          </div>

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

        {admin ? (
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
                  // ✅ 关键：切换按钮时清掉 preview，避免“短流动”
                  clearPreview();
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

        {/* 列表（删能用，说明 state 正常） */}
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900 }}>当前桶 segKey 列表</div>
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
                        startPreview([k], 900);
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
