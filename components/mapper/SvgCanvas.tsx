"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type SvgMeta = {
  segments: Array<{ segKey: string; stroke?: string }>;
};

type Props = {
  src: string;
  activeSegKeys: string[];
  onPick: (segKey: string) => void;
  onMeta?: (meta: SvgMeta) => void;
};

const SHAPE_SELECTOR = "path, polyline, line";
const KOREAN_RE = /[가-힣]/;

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}
function getStroke(el: SVGElement) {
  return (
    (el.getAttribute("stroke") ||
      (el.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] ||
      "").trim()
  );
}
function getStrokeWidth(el: SVGElement) {
  const swRaw =
    el.getAttribute("stroke-width") ||
    (el.getAttribute("style") || "").match(/stroke-width:\s*([^;]+)/i)?.[1] ||
    "";
  return parseFloat(String(swRaw).replace("px", "")) || 0;
}
function isGrayish(stroke: string) {
  const s = norm(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  return maxv - minv < 18;
}
function looksMeridianSegment(el: SVGElement) {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;
  if (isGrayish(stroke)) return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  if (sw <= 0) return false;

  // 放宽，避免“segments=0”
  if (sw > 8) return false;

  return true;
}

function ensureDocStyleOnce() {
  const id = "__tcm_mapper_anim_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
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
  document.head.appendChild(style);
}

export default function SvgCanvas({ src, activeSegKeys, onPick, onMeta }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  // debug（你别再猜）
  const [hostClicks, setHostClicks] = useState(0);
  const [hitClicks, setHitClicks] = useState(0);
  const [lastHit, setLastHit] = useState("");
  const [lastTarget, setLastTarget] = useState("");

  const activeSet = useMemo(() => new Set(activeSegKeys), [activeSegKeys]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setRaw("");
        const r = await fetch(src, { cache: "no-store" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const t = await r.text();
        if (!t.includes("<svg")) throw new Error("内容不是 SVG（可能 404 HTML）");
        if (!cancelled) setRaw(t);
      } catch (e: any) {
        if (!cancelled) setErr(`SVG 读取失败：${String(e?.message || e)}（${src}）`);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    ensureDocStyleOnce();
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";

    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // 让 svg 尺寸自适应
    if (!svg.getAttribute("viewBox")) {
      const w = parseFloat(svg.getAttribute("width") || "") || 0;
      const h = parseFloat(svg.getAttribute("height") || "") || 0;
      if (w > 0 && h > 0) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    svg.setAttribute("width", "100%");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    svg.style.maxWidth = "100%";

    // ✅ 关键：把 SVG 内部的 pointer-events 乱写，强行覆盖掉
    // 放在 SVG 末尾，配合 !important，赢过它自己原本的 style
    const peStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    peStyle.textContent = `
/* Force enable clicks for our hit layers (no matter what SVG internal CSS says) */
.tcm-hit { pointer-events: all !important; cursor: pointer !important; }
.tcm-hit * { pointer-events: all !important; }
`;
    svg.appendChild(peStyle);

    // 删韩文 text（可选）
    try {
      const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
      for (const t of texts) {
        const txt = (t.textContent || "").trim();
        if (txt && KOREAN_RE.test(txt)) t.remove();
      }
    } catch {}

    const candidates = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR)).filter(looksMeridianSegment);

    const meta: SvgMeta = { segments: [] };
    const cleanup: Array<() => void> = [];

    // 额外 debug：只要你点到 svg 的任何地方，应该能看到 target
    const svgCapture = (evt: MouseEvent) => {
      const t = evt.target as any;
      const tag = t?.tagName ? String(t.tagName).toLowerCase() : "(none)";
      const cls = t?.className ? String(t.className) : "";
      const dk = t?.getAttribute?.("data-segkey") || "";
      setLastTarget(`${tag}${cls ? ` .${cls}` : ""}${dk ? ` data-segkey=${dk}` : ""}`);
    };
    svg.addEventListener("click", svgCapture, true);
    cleanup.push(() => svg.removeEventListener("click", svgCapture, true));

    candidates.forEach((el, i) => {
      const segKey = `s${i}`;
      el.setAttribute("data-segkey", segKey);

      // hit layer：透明粗线
      const hit = el.cloneNode(true) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("data-segkey", segKey);
      hit.setAttribute("stroke", "rgba(0,0,0,0)");
      hit.setAttribute("fill", "none");

      const sw = getStrokeWidth(el);
      hit.setAttribute("stroke-width", String(Math.max(16, sw * 10)));

      // ✅ 关键：用 class + !important style 覆盖 SVG 内部禁用
      hit.setAttribute("class", `${hit.getAttribute("class") || ""} tcm-hit`.trim());
      (hit as any).style.pointerEvents = "all";

      // 放到顶层，避免被别的线盖住
      el.parentNode?.appendChild(hit);

      const fn = (evt: Event) => {
        evt.preventDefault();
        evt.stopPropagation();
        setHitClicks((c) => c + 1);
        setLastHit(segKey);
        onPick(segKey);
      };
      hit.addEventListener("click", fn);
      cleanup.push(() => hit.removeEventListener("click", fn));

      meta.segments.push({ segKey, stroke: getStroke(el) });
    });

    onMeta?.(meta);

    return () => cleanup.forEach((f) => f());
  }, [raw, onPick, onMeta]);

  // 动画：activeSegKeys 对应的线段加 m-active
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const all = Array.from(svg.querySelectorAll<SVGElement>(`${SHAPE_SELECTOR}[data-segkey]`));
    all.forEach((el) => el.classList.remove("m-active", "m-dim"));

    if (activeSet.size === 0) return;

    all.forEach((el) => el.classList.add("m-dim"));
    all.forEach((el) => {
      const k = el.getAttribute("data-segkey") || "";
      if (activeSet.has(k)) {
        el.classList.remove("m-dim");
        el.classList.add("m-active");
      }
    });
  }, [activeSet]);

  return (
    <div
      onClickCapture={(e) => {
        // ✅ 如果你点图区域这里都不涨，那就是“有透明遮罩盖住整个区域”
        setHostClicks((c) => c + 1);
        const t = e.target as any;
        const tag = t?.tagName ? String(t.tagName).toLowerCase() : "(none)";
        setLastTarget((prev) => prev || tag);
      }}
      style={{ position: "relative" }}
    >
      {err ? (
        <div style={{ padding: 10, border: "1px solid #f2c1c1", background: "#fff6f6", borderRadius: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>图没显示的原因：</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{err}</div>
        </div>
      ) : null}

      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8, lineHeight: 1.6 }}>
        hostClicks: <b>{hostClicks}</b> ｜ hitClicks: <b>{hitClicks}</b> ｜ lastHit: <code>{lastHit || "（无）"}</code>
        <br />
        target: <code>{lastTarget || "（无）"}</code>
      </div>

      <div ref={hostRef} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }} />
    </div>
  );
}
