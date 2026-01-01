"use client";

import React, { useMemo, useState } from "react";
import SvgCanvas, { SvgMeta } from "./SvgCanvas";

type Mode = "twelve" | "extra";

// 12经缩写：国际通用（也是你代码里那套）
const TWELVE = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"] as const;
type TwelveId = typeof TWELVE[number];

// 奇经八脉（你现在那张 8extra svg 也是 8组）
const EXTRA = ["REN","DU","CHONG","DAI","YINWEI","YANGWEI","YINQIAO","YANGQIAO"] as const;
type ExtraId = typeof EXTRA[number];

type MapData = {
  version: 1;
  svgSrc: string;
  updatedAt: string;
  twelve: Record<TwelveId, string[]>;
  extra: Record<ExtraId, string[]>;
};

function nowISO() {
  return new Date().toISOString();
}

function emptyMap(svgSrc: string): MapData {
  return {
    version: 1,
    svgSrc,
    updatedAt: nowISO(),
    twelve: Object.fromEntries(TWELVE.map((k) => [k, []])) as Record<TwelveId, string[]>,
    extra: Object.fromEntries(EXTRA.map((k) => [k, []])) as Record<ExtraId, string[]>,
  };
}

function storageKey(svgSrc: string) {
  return `tcm_mapper::v1::${svgSrc}`;
}

function loadMap(svgSrc: string): MapData {
  try {
    const raw = localStorage.getItem(storageKey(svgSrc));
    if (!raw) return emptyMap(svgSrc);
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return emptyMap(svgSrc);
    if (parsed?.svgSrc !== svgSrc) return emptyMap(svgSrc);
    // 容错：缺字段就补
    const base = emptyMap(svgSrc);
    return {
      ...base,
      ...parsed,
      twelve: { ...base.twelve, ...(parsed.twelve || {}) },
      extra: { ...base.extra, ...(parsed.extra || {}) },
    };
  } catch {
    return emptyMap(svgSrc);
  }
}

function saveMap(m: MapData) {
  localStorage.setItem(storageKey(m.svgSrc), JSON.stringify(m));
}

function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isColorish(stroke?: string) {
  const s = (stroke || "").trim().toLowerCase();
  if (!s || s === "none") return false;
  if (s === "#000" || s === "#000000" || s === "black") return false;
  if (s.startsWith("rgb(")) return true;
  if (s.startsWith("#")) return true;
  // 也可能是 named color
  return true;
}

export default function MapperApp() {
  const [mode, setMode] = useState<Mode>("twelve");

  const svgSrc = useMemo(() => {
    return mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";
  }, [mode]);

  const ids = mode === "twelve" ? TWELVE : EXTRA;

  const [meta, setMeta] = useState<SvgMeta | null>(null);

  const [selectedTwelve, setSelectedTwelve] = useState<TwelveId>("LU");
  const [selectedExtra, setSelectedExtra] = useState<ExtraId>("REN");
  const currentId = mode === "twelve" ? selectedTwelve : selectedExtra;

  const [mapData, setMapData] = useState<MapData>(() => emptyMap(svgSrc));
  const [importText, setImportText] = useState("");
  const [lastPick, setLastPick] = useState<string>("");

  // svgSrc 切换时重新读 localStorage
  React.useEffect(() => {
    const loaded = loadMap(svgSrc);
    setMapData(loaded);
    setLastPick("");
  }, [svgSrc]);

  const bucket = useMemo(() => {
    return mode === "twelve" ? mapData.twelve[currentId as TwelveId] : mapData.extra[currentId as ExtraId];
  }, [mapData, mode, currentId]);

  const activeSegKeys = bucket;

  const toggleSegInBucket = (segKey: string) => {
    setMapData((prev) => {
      const next: MapData = JSON.parse(JSON.stringify(prev));
      next.updatedAt = nowISO();
      const arr = mode === "twelve"
        ? next.twelve[currentId as TwelveId]
        : next.extra[currentId as ExtraId];
      const idx = arr.indexOf(segKey);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(segKey);
      saveMap(next);
      return next;
    });
  };

  const removeSeg = (segKey: string) => toggleSegInBucket(segKey);

  const doReset = () => {
    const fresh = emptyMap(svgSrc);
    saveMap(fresh);
    setMapData(fresh);
    setLastPick("");
    alert("已重置：映射清空。");
  };

  const doExport = () => {
    const txt = JSON.stringify(mapData, null, 2);
    downloadJson(`mapper_${mode}_${Date.now()}.json`, txt);
  };

  const doImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed?.version !== 1) throw new Error("version 不对");
      if (parsed?.svgSrc !== svgSrc) throw new Error("svgSrc 不匹配（你导入的是另一张 SVG 的映射）");
      saveMap(parsed);
      setMapData(loadMap(svgSrc));
      alert("导入成功。");
    } catch (e: any) {
      alert(`导入失败：${String(e?.message || e)}`);
    }
  };

  // ✅ Auto-map：按“颜色桶”把线段粗分成 12 组（只用来起稿）
  const autoMapByColor = () => {
    if (mode !== "twelve") {
      alert("Auto-map 目前只做 12经。");
      return;
    }
    if (!meta || meta.segments.length === 0) {
      alert("SVG 还没解析完（segments=0），等一下再点。");
      return;
    }

    // stroke -> segKeys
    const buckets = new Map<string, string[]>();
    for (const s of meta.segments) {
      if (!isColorish(s.stroke)) continue;
      const key = (s.stroke || "").trim().toLowerCase();
      const arr = buckets.get(key) || [];
      arr.push(s.segKey);
      buckets.set(key, arr);
    }

    const top = Array.from(buckets.entries())
      .map(([stroke, segKeys]) => ({ stroke, segKeys, n: segKeys.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    if (top.length < 8) {
      alert(`颜色组太少（${top.length}），这张 SVG 可能不是按颜色区分经络。`);
      return;
    }

    const next = emptyMap(svgSrc);
    for (let i = 0; i < Math.min(12, top.length); i++) {
      next.twelve[TWELVE[i]] = top[i].segKeys.slice();
    }
    next.updatedAt = nowISO();
    saveMap(next);
    setMapData(next);
    alert("已生成 12 组初稿。现在你可以逐个按钮点线段：点=加入/移除，随时修正。");
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Meridian Mapper（重写版）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            用法：先选右侧按钮（LU/LI…）→ 再点左边彩色经络线段 → 立刻加入/移除映射。<br />
            选中经络后，该经络线会持续流动（方便你核对）。
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("twelve")}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 10,
              border: mode === "twelve" ? "2px solid #111" : "1px solid #ddd",
              background: mode === "twelve" ? "#111" : "#fafafa",
              color: mode === "twelve" ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            12经
          </button>
          <button
            onClick={() => setMode("extra")}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 10,
              border: mode === "extra" ? "2px solid #111" : "1px solid #ddd",
              background: mode === "extra" ? "#111" : "#fafafa",
              color: mode === "extra" ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            任督+奇经
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 420px", gap: 12 }}>
        {/* 左：图 */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <SvgCanvas
            src={svgSrc}
            activeSegKeys={activeSegKeys}
            onMeta={setMeta}
            onPick={(segKey) => {
              setLastPick(segKey);
              toggleSegInBucket(segKey); // ✅ 点线段直接加/删映射
            }}
          />

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
            segments: <b>{meta?.segments.length ?? "?"}</b> ｜ lastPick: <code>{lastPick || "（无）"}</code>
          </div>
        </div>

        {/* 右：控制 */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>映射管理</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              updated: <code style={{ fontSize: 11 }}>{mapData.updatedAt}</code>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mode === "twelve" ? (
              <button
                onClick={autoMapByColor}
                style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
              >
                Auto-map（生成初稿）
              </button>
            ) : null}

            <button
              onClick={doReset}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #f2c1c1", background: "#fff6f6", fontWeight: 900 }}
            >
              重置（清空）
            </button>

            <button
              onClick={doExport}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
            >
              导出 JSON
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: mode === "twelve" ? "repeat(6, 1fr)" : "repeat(4, 1fr)", gap: 8 }}>
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
            当前选中：<code>{currentId}</code> ｜ 当前桶线段数：<b>{bucket.length}</b>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontWeight: 900 }}>当前经络的线段列表（点“删”可移除）</div>
            <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", border: "1px solid #eee", borderRadius: 12, padding: 8 }}>
              {bucket.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>（空）——先点左边彩色经络线段来加入。</div>
              ) : (
                bucket.map((k) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                    <code style={{ fontSize: 11 }}>{k}</code>
                    <button
                      onClick={() => removeSeg(k)}
                      style={{ cursor: "pointer", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", padding: "2px 10px", fontWeight: 900 }}
                    >
                      删
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontWeight: 900 }}>导入 JSON（可选）</div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="把导出的 JSON 粘贴到这里，然后点导入。"
              style={{ width: "100%", minHeight: 110, marginTop: 8, borderRadius: 12, border: "1px solid #ddd", padding: 10, fontSize: 12 }}
            />
            <div style={{ marginTop: 8 }}>
              <button
                onClick={doImport}
                style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
              >
                导入
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
