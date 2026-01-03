"use client";

import React, { useEffect, useRef, useState } from "react";

type ExtraId = "REN" | "DU";
const EXTRA: ExtraId[] = ["REN", "DU"];

const SVG_SRC = "/assets/12meridians8extra_CVGV.svg";
const BUILD = "MAPPER_EXTRA_RENDU_BUILD_001";

// 独立存储：不影响12经
const STORAGE_KEY = `tcm_mapper_extra::${SVG_SRC}`;

type MapData = Record<ExtraId, string[]>;
function emptyMap(): MapData {
  return { REN: [], DU: [] };
}
function loadMap(): MapData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMap();
    const parsed = JSON.parse(raw);
    return { ...emptyMap(), ...(parsed || {}) };
  } catch {
    return emptyMap();
  }
}
function saveMap(m: MapData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

function norm(s: string) { return (s || "").trim().toLowerCase(); }
function normStroke(s: string) { return norm(s).replace(/\s+/g, ""); }
function getStroke(el: SVGElement) {
  return (el.getAttribute("stroke") || (el.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] || "").trim();
}
function getStrokeWidth(el: SVGElement) {
  const sw = el.getAttribute("stroke-width") || (el.getAttribute("style") || "").match(/stroke-width:\s*([^;]+)/i)?.[1] || "";
  return parseFloat(String(sw).replace("px", "")) || 0;
}
function isGrayishLoose(stroke: string) {
  const s = normStroke(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;

  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (m) {
    const r=+m[1], g=+m[2], b=+m[3];
    return Math.max(r,g,b) - Math.min(r,g,b) < 22;
  }
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return Math.max(r,g,b) - Math.min(r,g,b) < 22;
  }
  return false;
}

// 这里别太苛刻：REN/DU图里线条可能比12经粗、结构也不同
function looksSegment(el: SVGElement) {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;

  const fill = norm(el.getAttribute("fill") || "");
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  if (sw <= 0) return false;
  if (sw > 20) return false;

  // 长度过滤：太短的碎片不要
  try {
    const anyEl: any = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 12) return false;
    }
  } catch {}

  return true;
}

function cleanMapData(input: MapData, opts: { skipMap: Record<string, boolean>; known: Record<string, boolean> }) {
  const out = emptyMap();
  let changed = false;

  for (const id of EXTRA) {
    const src = Array.isArray((input as any)?.[id]) ? ((input as any)[id] as string[]) : [];
    const seen = new Set<string>();
    const cleaned: string[] = [];

    for (const k of src) {
      if (typeof k !== "string") { changed = true; continue; }
      if (!k.startsWith("s")) { changed = true; continue; }
      if (opts.skipMap[k]) { changed = true; continue; }
      if (!opts.known[k]) { changed = true; continue; }
      if (seen.has(k)) { changed = true; continue; }
      seen.add(k);
      cleaned.push(k);
    }
    (out as any)[id] = cleaned;
    if (cleaned.length !== src.length) changed = true;
  }

  return { out, changed };
}

export default function MapperExtraRenDu() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<ExtraId>("REN");
  const [mapData, setMapData] = useState<MapData>(emptyMap());

  const segSkipRef = useRef<Record<string, boolean>>({});
  const segKnownRef = useRef<Record<string, boolean>>({});

  const bucket = mapData[selected] || [];

  useEffect(() => {
    setMapData(loadMap());
  }, []);

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

  // 注入 SVG + hit layer
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

    // 抢回 pointer-events + 动画样式
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

    // 删韩文 text（你稳定版同套路）
    try {
      const texts = Array.from(svg.querySelectorAll("text"));
      texts.forEach((t) => {
        const s = (t.textContent || "").trim();
        if (/[가-힣]/.test(s)) t.remove();
      });
    } catch {}

    // rebuild seg maps
    segSkipRef.current = {};
    segKnownRef.current = {};

    const shapes = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line")).filter(looksSegment);

    shapes.forEach((el, i) => {
      const segKey = `s${i}`;
      el.setAttribute("data-segkey", segKey);

      const strokeNorm = normStroke(getStroke(el) || "");
      const skip = strokeNorm ? isGrayishLoose(strokeNorm) : false;
      if (skip) {
        el.setAttribute("data-skip", "1");
        segSkipRef.current[segKey] = true;
        segKnownRef.current[segKey] = true; // 记录存在，但跳过
        return;
      }

      segKnownRef.current[segKey] = true;

      const hit = el.cloneNode(true) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("data-segkey", segKey);
      hit.setAttribute("stroke", "rgba(0,0,0,0)");
      hit.setAttribute("fill", "none");
      const sw = getStrokeWidth(el);
      hit.setAttribute("stroke-width", String(Math.max(18, sw * 10)));
      hit.setAttribute("class", `${(hit.getAttribute("class") || "")} tcm-hit`.trim());

      el.parentNode?.appendChild(hit);

      hit.addEventListener("click", (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        setMapData((prev) => {
          const next: MapData = JSON.parse(JSON.stringify(prev));
          const arr = next[selected] || [];
          const idx = arr.indexOf(segKey);
          if (idx >= 0) arr.splice(idx, 1);
          else arr.push(segKey);
          next[selected] = arr;

          const cleaned = cleanMapData(next, { skipMap: segSkipRef.current, known: segKnownRef.current });
          saveMap(cleaned.out);
          return cleaned.out;
        });
      });
    });

    // ✅ 自动清理：把旧映射里的 skip / 不存在 segKey 清掉
    try {
      const cleaned = cleanMapData(mapData, { skipMap: segSkipRef.current, known: segKnownRef.current });
      if (cleaned.changed) {
        saveMap(cleaned.out);
        setMapData(cleaned.out);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  // bucket -> 动画（先全清再设）
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const all = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line")).filter((el) =>
      (el.getAttribute("data-segkey") || "").startsWith("s")
    );

    all.forEach((el) => {
      el.classList.remove("m-active");
      el.classList.remove("m-dim");
    });

    all.forEach((el) => el.classList.add("m-dim"));

    if (!bucket.length) return;

    const set = new Set(bucket);
    const skip = segSkipRef.current;

    all.forEach((el) => {
      const k = el.getAttribute("data-segkey") || "";
      if (!k) return;
      if (skip[k]) return;
      if (set.has(k)) {
        el.classList.remove("m-dim");
        el.classList.add("m-active");
      }
    });
  }, [bucket, selected]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 1000 }}>{BUILD} — Mapper Extra（任督）</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        独立存储，不影响12经：<code>{STORAGE_KEY}</code>
      </div>

      <div style={{ marginTop: 10 }}>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
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
          <div style={{ fontWeight: 900, marginBottom: 8 }}>选择（REN / DU）</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {EXTRA.map((id) => {
              const on = id === selected;
              return (
                <button
                  key={id}
                  onClick={() => setSelected(id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 12,
                    padding: "10px 10px",
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

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const empty = emptyMap();
                saveMap(empty);
                setMapData(empty);
                alert("已清空 REN/DU 映射。");
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
              清空
            </button>

            <button
              onClick={() => {
                const txt = JSON.stringify(mapData, null, 2);
                navigator.clipboard?.writeText(txt);
                alert("已复制 JSON 到剪贴板");
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
              复制 JSON
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            当前 <code>{selected}</code> ｜ 线段数：<b>{bucket.length}</b>
          </div>

          <div style={{ marginTop: 10, maxHeight: 320, overflow: "auto", border: "1px solid #eee", borderRadius: 12, padding: 8 }}>
            {bucket.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>（空）——点左边红色经络线段添加。</div>
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
                        const cleaned = cleanMapData(next, { skipMap: segSkipRef.current, known: segKnownRef.current });
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
