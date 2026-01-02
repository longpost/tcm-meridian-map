"use client";

import React, { useEffect, useRef, useState } from "react";

type TwelveId = "LU"|"LI"|"ST"|"SP"|"HT"|"SI"|"BL"|"KI"|"PC"|"SJ"|"GB"|"LR";
const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

const SVG_SRC = "/assets/12meridians12shichen.svg";
const BUILD = "MAPPER_SINGLEFILE_BUILD_005_AUTOMAP";

type MapData = Record<TwelveId, string[]>;
const STORAGE_KEY = `tcm_mapper_single::${SVG_SRC}`;

function loadMap(): MapData {
  const empty = Object.fromEntries(TWELVE.map(k => [k, []])) as MapData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return { ...empty, ...(parsed || {}) };
  } catch {
    return empty;
  }
}
function saveMap(m: MapData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

function norm(s: string) { return (s||"").trim().toLowerCase(); }
function normStroke(s: string) {
  // 统一一点，避免 " rgb(…)" / "#ABC" 之类
  return norm(s).replace(/\s+/g, "");
}
function getStroke(el: SVGElement) {
  return (el.getAttribute("stroke") || (el.getAttribute("style")||"").match(/stroke:\s*([^;]+)/i)?.[1] || "").trim();
}
function getStrokeWidth(el: SVGElement) {
  const sw = el.getAttribute("stroke-width") || (el.getAttribute("style")||"").match(/stroke-width:\s*([^;]+)/i)?.[1] || "";
  return parseFloat(String(sw).replace("px","")) || 0;
}
function isGrayish(stroke: string) {
  const s = normStroke(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r=+m[1], g=+m[2], b=+m[3];
  return Math.max(r,g,b)-Math.min(r,g,b) < 18;
}

// 更宽松的“灰/轮廓”判断：支持 hex、rgb，专门用于标记 skip。
// ⚠️ 不能用它去过滤 shapes（否则 segKey 序号会变，旧映射会乱）。
function isGrayishLoose(stroke: string) {
  const s = normStroke(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;

  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (m) {
    const r=+m[1], g=+m[2], b=+m[3];
    return Math.max(r,g,b)-Math.min(r,g,b) < 22;
  }

  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return Math.max(r,g,b)-Math.min(r,g,b) < 22;
  }

  return false;
}

function looksMeridian(el: SVGElement) {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;
  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;
  if (isGrayish(stroke)) return false;
  const fill = norm(el.getAttribute("fill") || "");
  if (fill && fill !== "none" && fill !== "transparent") return false;
  const sw = getStrokeWidth(el);
  if (sw <= 0) return false;
  if (sw > 10) return false;
  try {
    const anyEl: any = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 10) return false;
    }
  } catch {}
  return true;
}

function cleanMapData(input: MapData, opts: { skipMap?: Record<string, boolean>; knownSegs?: Record<string, string> }) {
  const out = Object.fromEntries(TWELVE.map(k => [k, []])) as MapData;
  const skip = opts.skipMap || {};
  const known = opts.knownSegs || {};

  let changed = false;
  for (const id of TWELVE) {
    const src = Array.isArray((input as any)?.[id]) ? ((input as any)[id] as string[]) : [];
    const seen = new Set<string>();
    const cleaned: string[] = [];

    for (const k of src) {
      if (typeof k !== "string") { changed = true; continue; }
      if (!k.startsWith("s")) { changed = true; continue; }
      if (skip[k]) { changed = true; continue; }
      if (Object.keys(known).length && !(k in known)) { changed = true; continue; }
      if (seen.has(k)) { changed = true; continue; }
      seen.add(k);
      cleaned.push(k);
    }

    out[id] = cleaned;
    if (src.length !== cleaned.length) changed = true;
  }
  return { out, changed };
}

export default function MapperSingleFile() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  // debug
  const [pageClicks, setPageClicks] = useState(0);
  const [svgTarget, setSvgTarget] = useState<string>("(none)");
  const [hitClicks, setHitClicks] = useState(0);
  const [lastHit, setLastHit] = useState<string>("(none)");

  const [selected, setSelected] = useState<TwelveId>("LU");
  const [mapData, setMapData] = useState<MapData>(() => ({} as any));
  const bucket = mapData[selected] || [];

  // ✅ 新增：记录 segKey -> stroke，用于自动映射
  const segStrokeRef = useRef<Record<string, string>>({});
  // ✅ 新增：标记 segKey 是否应跳过（人体轮廓/灰色/不该参与映射的线）
  const segSkipRef = useRef<Record<string, boolean>>({});
  const [autoInfo, setAutoInfo] = useState<string>("");

  // load mapping
  useEffect(() => {
    const m = loadMap();
    setMapData(m);
  }, []);

  // fetch svg
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setErr("");
        const r = await fetch(SVG_SRC, { cache: "no-store" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const t = await r.text();
        if (!t.includes("<svg")) throw new Error("Not SVG (maybe 404 HTML)");
        if (!cancel) setRaw(t);
      } catch (e: any) {
        if (!cancel) setErr(String(e?.message || e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  // inject svg + build hit layers
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    svg.style.pointerEvents = "auto";

    // ✅ 强行覆盖 SVG 内部 pointer-events（关键！）
    const peStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    peStyle.textContent = `
      .tcm-hit { pointer-events: all !important; cursor: pointer !important; }
      .tcm-hit * { pointer-events: all !important; }

      @keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-26;} }
      .m-dim { opacity: 0.10; }
      .m-active {
        opacity: 1 !important;
        stroke-dasharray: 7 6;
        animation: tcmFlow 1.15s linear infinite;
        filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `;
    svg.appendChild(peStyle);

    // remove Korean labels if any
    try {
      const texts = Array.from(svg.querySelectorAll("text"));
      texts.forEach((t) => {
        const s = (t.textContent || "").trim();
        if (/[가-힣]/.test(s)) t.remove();
      });
    } catch {}

    // svg capture (prove clicks reach svg)
    const cap = (e: MouseEvent) => {
      const t: any = e.target;
      const tag = t?.tagName ? String(t.tagName).toLowerCase() : "(none)";
      const cls = t?.className ? String(t.className) : "";
      const dk = t?.getAttribute?.("data-segkey") || "";
      setSvgTarget(`${tag}${cls ? ` .${cls}` : ""}${dk ? ` data-segkey=${dk}` : ""}`);
    };
    svg.addEventListener("click", cap, true);

    // ✅ 清空 stroke/skip 记录并重建
    segStrokeRef.current = {};
    segSkipRef.current = {};
    setAutoInfo("");

    // build hit layers
    const shapes = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line")).filter(looksMeridian);

    shapes.forEach((el, i) => {
      const segKey = `s${i}`;
      el.setAttribute("data-segkey", segKey);

      // ✅ 记录 stroke
      const strokeNorm = normStroke(getStroke(el) || "");
      segStrokeRef.current[segKey] = strokeNorm;

      // ✅ 轮廓/灰色线：标记 skip（但不改变 segKey 序号），并且不创建 hit layer
      // 这样：1) 点不到轮廓，不会再误加入映射；2) 旧映射里如果已有轮廓 segKey，会被自动清理/忽略。
      const skip = strokeNorm ? isGrayishLoose(strokeNorm) : false;
      if (skip) {
        el.setAttribute("data-skip", "1");
        segSkipRef.current[segKey] = true;
        return;
      }

      // hit clone
      const hit = el.cloneNode(true) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("data-segkey", segKey);
      hit.setAttribute("stroke", "rgba(0,0,0,0)");
      hit.setAttribute("fill", "none");
      const sw = getStrokeWidth(el);
      hit.setAttribute("stroke-width", String(Math.max(18, sw * 10)));
      hit.setAttribute("class", `${(hit.getAttribute("class") || "")} tcm-hit`.trim());

      // put on top
      el.parentNode?.appendChild(hit);

      hit.addEventListener("click", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        setHitClicks((c) => c + 1);
        setLastHit(segKey);

        // 点一下：加入/移除映射（同时自动清理 skip / 不存在的 segKey）
        setMapData((prev) => {
          const next: MapData = JSON.parse(JSON.stringify(prev));
          const arr = next[selected] || [];
          const idx = arr.indexOf(segKey);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push(segKey);
          next[selected] = arr;

          const cleaned = cleanMapData(next, { skipMap: segSkipRef.current, knownSegs: segStrokeRef.current });
          saveMap(cleaned.out);
          return cleaned.out;
        });
      });
    });

    // ✅ 自动清理：SVG 注入后，把旧映射里误加的“轮廓/灰色线”等 skip segKey 清掉
    // 这一步是自动的，你不用手动删。
    try {
      const cleaned = cleanMapData(mapData, { skipMap: segSkipRef.current, knownSegs: segStrokeRef.current });
      if (cleaned.changed) {
        saveMap(cleaned.out);
        setMapData(cleaned.out);
      }
    } catch {}

    // 给自动映射提示一点信息
    const uniqColors = new Set(Object.values(segStrokeRef.current).filter(Boolean));
    setAutoInfo(`可用颜色桶数：${uniqColors.size}（用于 Auto-map）`);

    return () => {
      svg.removeEventListener("click", cap, true);
    };
  }, [raw, selected]);

  // apply animation (bucket -> m-active)
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const all = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line")).filter((el) =>
      (el.getAttribute("data-segkey") || "").startsWith("s")
    );

    const skip = segSkipRef.current;

    // 先全清：避免切换经络后残留上一次的流动效果
    all.forEach((el) => {
      el.classList.remove("m-active");
      el.classList.remove("m-dim");
    });

    // 再统一 dim
    all.forEach((el) => el.classList.add("m-dim"));

    if (!bucket.length) return;

    const set = new Set(bucket);
    all.forEach((el) => {
      const k = el.getAttribute("data-segkey") || "";
      if (!k) return;
      if (skip[k]) return; // ✅ 人体轮廓等永远不 active
      if (set.has(k)) {
        el.classList.remove("m-dim");
        el.classList.add("m-active");
      }
    });
  }, [bucket, raw]);

  // ✅ 新增：自动映射（按 stroke 颜色分桶）
  const autoMap = () => {
    const segStroke = segStrokeRef.current;
    const skip = segSkipRef.current;
    const entries = Object.entries(segStroke).filter(([segKey, stroke]) => {
      if (!stroke || stroke === "none") return false;
      if (skip[segKey]) return false;
      // 这里只做一个粗过滤：明显灰色的不要（rgb黑灰等）
      if (isGrayish(stroke)) return false;
      return true;
    });

    if (entries.length < 20) {
      alert("Auto-map 失败：当前 SVG 解析到的彩色线段太少（可能 SVG 还没加载好）。");
      return;
    }

    const buckets = new Map<string, string[]>();
    for (const [segKey, stroke] of entries) {
      const key = normStroke(stroke);
      const arr = buckets.get(key) || [];
      arr.push(segKey);
      buckets.set(key, arr);
    }

    const top = Array.from(buckets.entries())
      .map(([stroke, segKeys]) => ({ stroke, segKeys, n: segKeys.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    if (top.length < 8) {
      alert(`Auto-map 失败：颜色桶太少（${top.length}）。这张 SVG 可能不是按颜色分经。`);
      return;
    }

    const next = Object.fromEntries(TWELVE.map(k => [k, []])) as MapData;
    for (let i = 0; i < Math.min(12, top.length); i++) {
      next[TWELVE[i]] = top[i].segKeys.slice();
    }

    // 再跑一次 clean，避免把 skip 混进来（保险）
    const cleaned = cleanMapData(next, { skipMap: segSkipRef.current, knownSegs: segStrokeRef.current });

    saveMap(cleaned.out);
    setMapData(cleaned.out);

    const summary = top.map((g, i) => `${TWELVE[i]}<=${g.n}`).join("  ");
    alert("已生成自动映射初稿（按颜色桶）。\n接下来你用“点线段增删”微调就行。\n" + summary);
  };

  return (
    <main
      style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}
      onClickCapture={() => setPageClicks((c) => c + 1)}
    >
      <div style={{ fontSize: 22, fontWeight: 1000 }}>
        {BUILD} — Mapper
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
        pageClicks: <b>{pageClicks}</b> ｜ hitClicks: <b>{hitClicks}</b> ｜ lastHit: <code>{lastHit}</code>
        <br />
        svg target: <code>{svgTarget}</code>
        <br />
        {autoInfo ? <span>{autoInfo}</span> : null}
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #f2c1c1", background: "#fff6f6" }}>
          SVG 加载失败：<b>{err}</b>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 420px", gap: 12 }}>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div ref={hostRef} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }} />
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>选择经络（点线段即可加入/移除）</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              onClick={autoMap}
              style={{
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fafafa",
                fontWeight: 900
              }}
            >
              Auto-map（按颜色生成初稿）
            </button>

            <button
              onClick={() => {
                const empty = Object.fromEntries(TWELVE.map(k => [k, []])) as MapData;
                saveMap(empty);
                setMapData(empty);
                alert("已清空。");
              }}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #f2c1c1", background: "#fff6f6", fontWeight: 900 }}
            >
              清空全部
            </button>

            <button
              onClick={() => {
                const txt = JSON.stringify(mapData, null, 2);
                navigator.clipboard?.writeText(txt);
                alert("已复制 JSON 到剪贴板");
              }}
              style={{ cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", fontWeight: 900 }}
            >
              复制 JSON
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {TWELVE.map((id) => {
              const on = id === selected;
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
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

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            当前 <code>{selected}</code> ｜ 线段数：<b>{bucket.length}</b>
          </div>

          <div style={{ marginTop: 10, maxHeight: 320, overflow: "auto", border: "1px solid #eee", borderRadius: 12, padding: 8 }}>
            {bucket.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>（空）——先点左边彩色线段来添加。</div>
            ) : (
              bucket.map((k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                  <code style={{ fontSize: 11 }}>{k}</code>
                  <button
                    onClick={() => {
                      setMapData((prev) => {
                        const next: MapData = JSON.parse(JSON.stringify(prev));
                        const arr = next[selected] || [];
                        const idx = arr.indexOf(k);
                        if (idx >= 0) arr.splice(idx, 1);
                        next[selected] = arr;

                        const cleaned = cleanMapData(next, { skipMap: segSkipRef.current, knownSegs: segStrokeRef.current });
                        saveMap(cleaned.out);
                        return cleaned.out;
                      });
                    }}
                    style={{ cursor: "pointer", borderRadius: 10, border: "1px solid #ddd", background: "#fafafa", padding: "2px 10px", fontWeight: 900 }}
                  >
                    删
                  </button>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
