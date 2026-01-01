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

  // 不要太严，否则你又“segments=0”
  if (sw > 3.2) return false;

  try {
    const anyEl = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 20) return false;
    }
  } catch {}

  return true;
}

function ensureStyleOnce() {
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

  const activeSet = useMemo(() => new Set(activeSegKeys), [activeSegKeys]);

  // fetch svg
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

  // inject + make clickable
  useEffect(() => {
    ensureStyleOnce();
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // size fit
    if (!svg.getAttribute("viewBox")) {
      const w = parseFloat(svg.getAttribute("width") || "") || 0;
      const h = parseFloat(svg.getAttribute("height") || "") || 0;
      if (w > 0 && h > 0) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    svg.setAttribute("width", "100%");
    svg.removeAttribute("height");
    (svg.style as any).width = "100%";
    (svg.style as any).height = "auto";
    (svg.style as any).display = "block";
    (svg.style as any).maxWidth = "100%";

    // everything not clickable by default
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // remove Korean labels (so you stop seeing 韩文)
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

    candidates.forEach((el, i) => {
      const segKey = `s${i}`;

      // original: animate here
      el.setAttribute("data-segkey", segKey);
      (el as any).style.pointerEvents = "none";

      // hit layer: transparent thick stroke
      const hit = el.cloneNode(true) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("data-segkey", segKey);
      hit.setAttribute("stroke", "rgba(0,0,0,0)");
      hit.setAttribute("fill", "none");

      const sw = getStrokeWidth(el);
      hit.setAttribute("stroke-width", String(Math.max(12, sw * 6)));
      (hit as any).style.pointerEvents = "stroke";
      (hit as any).style.cursor = "pointer";

      el.parentNode?.insertBefore(hit, el);

      const fn = (evt: Event) => {
        evt.preventDefault();
        evt.stopPropagation();
        onPick(segKey);
      };
      hit.addEventListener("click", fn);
      cleanup.push(() => hit.removeEventListener("click", fn));

      meta.segments.push({ segKey, stroke: getStroke(el) });
    });

    onMeta?.(meta);

    return () => cleanup.forEach((f) => f());
  }, [raw, onPick, onMeta]);

  // apply animation classes
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const segs = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    segs.forEach((el) => el.classList.remove("m-active", "m-dim"));

    if (activeSet.size === 0) return;

    // dim all candidates, highlight actives
    const all = Array.from(svg.querySelectorAll<SVGElement>(`${SHAPE_SELECTOR}[data-segkey]`));
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
    <div>
      {err ? (
        <div style={{ padding: 10, border: "1px solid #f2c1c1", background: "#fff6f6", borderRadius: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>图没显示的原因：</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{err}</div>
        </div>
      ) : null}
      <div ref={hostRef} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }} />
    </div>
  );
}
