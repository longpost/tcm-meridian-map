"use client";

import React, { useMemo, useState } from "react";
import InlineSvg from "./InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type ExtraId, type MapShape } from "../lib/meridianMap";

type Mode = "twelve" | "extra";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];
const EXTRA: ExtraId[] = ["REN","DU","CHONG","DAI","YINWEI","YANGWEI","YINQIAO","YANGQIAO"];

function isTwelveMode(svgPath: string): boolean {
  return svgPath.includes("12meridians12shichen");
}

function prettyId(id: string) {
  return id;
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

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const mode: Mode = isTwelveMode(svgPath) ? "twelve" : "extra";

  const [admin, setAdmin] = useState(false);

  // 当前选中的经络（正常模式）
  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");

  // 映射草稿：允许你在页面上临时改，导出 JSON 后再粘回 lib/meridianMap.ts
  const [draftMap, setDraftMap] = useState<MapShape>(MERIDIAN_MAP);

  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const activeSegKeys = useMemo(() => {
    return mode === "twelve" ? (draftMap.twelve[selectedTwelve] || []) : (draftMap.extra[selectedExtra] || []);
  }, [draftMap, mode, selectedTwelve, selectedExtra]);

  // 映射模式：当前正在映射哪条经（可以跟正常选中一致）
  const mappingId = currentId;

  const draftSegKeys = useMemo(() => {
    if (!admin) return [];
    return mode === "twelve" ? (draftMap.twelve[mappingId as TwelveId] || []) : (draftMap.extra[mappingId as ExtraId] || []);
  }, [admin, draftMap, mode, mappingId]);

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    if (admin) {
      // 映射模式：点一下加入/再点一下移除
      setDraftMap((prev) => {
        const next: MapShape = JSON.parse(JSON.stringify(prev));
        const bucket = mode === "twelve"
          ? (next.twelve[mappingId as TwelveId] ||= [])
          : (next.extra[mappingId as ExtraId] ||= []);

        const idx = bucket.indexOf(segKey);
        if (idx >= 0) bucket.splice(idx, 1);
        else bucket.push(segKey);

        return next;
      });
      return;
    }

    // 正常模式：点线段反查属于哪个经
    const mapObj = mode === "twelve" ? draftMap.twelve : draftMap.extra;
    const hit = reverseLookup(mapObj as any, segKey);

    if (hit) {
      if (mode === "twelve") setSelectedTwelve(hit as TwelveId);
      else setSelectedExtra(hit as ExtraId);
    }
  };

  const ids = mode === "twelve" ? TWELVE : EXTRA;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          draftSegKeys={admin ? draftSegKeys : []}
          onPickSeg={onPickSeg}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          {admin
            ? "【映射模式】点线段：加入/移除当前经络。橙色=你正在映射的段；蓝色=当前高亮。"
            : "点线段会反选右侧按钮；点按钮会高亮对应经络。人体轮廓不可点。"}
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

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
                {prettyId(id)}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, borderTop: "1px dashed #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>当前选中</div>
          <div>
            <code>{currentId}</code>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            线段数：<b>{activeSegKeys.length}</b>
            <br />
            {admin
              ? "映射时：点线段加入/移除；完成后导出 JSON，粘贴回 lib/meridianMap.ts。"
              : "如果点线段没有反选按钮，说明那段还没被映射到任何经络。"}
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

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
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



