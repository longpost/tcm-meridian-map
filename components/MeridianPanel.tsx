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

  // ✅ 新增：预览流动（点线就立即流动、看清楚）
  const [previewSegKeys, setPreviewSegKeys] = useState<string[]>([]);
  const previewTimer = useRef<number | null>(null);

  // 1) 先读 localStorage，读完才允许回写
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

  // ✅ mapper 显示的“流动”优先级：
  // 1) 如果有 preview（刚点线），先流动 preview
  // 2) 否则流动当前选中桶（跟 view 一样）
  const activeSegKeys = useMemo(() => {
    if (previewSegKeys.length) return previewSegKeys;
    return bucketSegKeys;
  }, [previewSegKeys, bucketSegKeys]);

  const startPreview = (keys: string[]) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    setPreviewSegKeys(keys);
    previewTimer.current = window.setTimeout(() => setPreviewSegKeys([]), 800);
  };

  const onPickSeg = ({ segKey }: { segKey: string }) => {
    // 任何时候点到线：先给个即时流动反馈
    startPreview([segKey]);

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
    setPreviewSegKeys([]);
    alert("已清空本 SVG 的本地映射（localStorage）。");
  };

  // ✅ 你提到“只有6组韩文为什么不是12”：
  // 这张 SVG 的图例本来就可能只画了 6 个（或者剩下 6 个在别处/用别的形式）。
  // 我这里已经把韩文 text 全删掉了（InlineSvg 里做的），避免视觉干扰。
  // 要加英文名称：建议在右侧做一个“颜色->经络”小图例（后面我可以加）。

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
      {/* 左：图 */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff", overflow: "hidden" }}>
        <InlineSvg
          src={svgPath}
          activeSegKeys={activeSegKeys}
          // 映射模式下给 draft 也亮出来，方便你看当前桶覆盖范围
          draftSegKeys={admin ? bucketSegKeys : []}
          onPickSeg={onPickSeg}
          onMeta={setMeta}
        />
      </div>

      {/* 右：控制/列表 */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "twelve" ? "12经络（Mapper）" : "任督 + 奇经八脉（Mapper）"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              admin：<b>{String(admin)}</b>｜loaded：<b>{String(loaded)}</b>
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

                  // ✅ mapper 选名称立即流动（跟 view 一样）
                  // 这里不需要额外处理：activeSegKeys 会指向该桶
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

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
          当前选中：<code>{currentId}</code><br />
          当前桶线段数：<b>{bucketSegKeys.length}</b><br />
          可点线段总数：<b>{meta?.segments?.length ?? "?"}</b>
        </div>

        {admin ? (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        {/* ✅ 关键：把“加上没有”变成看得见 */}
        <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900 }}>当前桶 segKey 列表</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            映射模式下：点线段 = 加/删；点完马上会预览流动 0.8 秒。
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
                        // 删除该 segKey
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
