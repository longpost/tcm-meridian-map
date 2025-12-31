"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg from "./InlineSvg";
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

function storageKey(svgPath: string) {
  return `tcm_meridian_map::${svgPath}`;
}

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";

  const [admin, setAdmin] = useState(false);
  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");

  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);

  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;
  const ids = mode === "twelve" ? TWELVE : EXTRA;

  // ✅ 启动时：自动从 localStorage 恢复
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(svgPath));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) setDraftMap(parsed);
      }
    } catch {}
  }, [svgPath]);

  // ✅ 每次映射变化：自动保存到 localStorage
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 上：控制区（按钮一定能点） */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "12经络" : "任督 + 奇经八脉"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              ✅ 映射会自动保存到浏览器本地（localStorage），viewer/quiz 会自动读取。
              <br />
              要发布给所有用户：用“导出 JSON”粘到 <code>lib/meridianMap.ts</code>。
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

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(6, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
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

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          当前选中：<code>{currentId}</code>，线段数：<b>{activeSegKeys.length}</b>，admin：<b>{String(admin)}</b>
        </div>

        {admin ? (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => {
                const txt = exportJson(draftMap);
                navigator.clipboard?.writeText(txt);
                alert("已复制映射 JSON（同时已自动保存到本地）");
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

            <button
              onClick={() => {
                if (!confirm("确认清空本 SVG 的本地映射？（只影响你这个浏览器）")) return;
                localStorage.removeItem(storageKey(svgPath));
                setDraftMap(MERIDIAN_MAP);
              }}
              style={{
                marginLeft: 8,
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #f2c1c1",
                background: "#fff6f6",
                fontWeight: 900,
              }}
            >
              清空本地映射
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

      {/* 下：SVG 区 */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff", overflow: "hidden" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? activeSegKeys : []}
          onPickSeg={onPickSeg}
        />
      </div>
    </div>
  );
}
