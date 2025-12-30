"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type PickSeg = { segKey: string };

type Props = {
  src: string;

  // 需要高亮的线段 keys（某条经络映射到的 segments）
  activeSegKeys: string[];

  // 映射模式下：当前“正在映射”的经络的线段（用于预览）
  draftSegKeys?: string[];

  // 点击线段回调
  onPickSeg?: (pick: PickSeg) => void;
};

const SHAPE_SELECTOR = "path, polyline, line";

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

function isGrayOrBlack(stroke: string) {
  const s = norm(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;
  if (s === "#8c8e91" || s === "#a9b5bf" || s === "#666" || s === "#777" || s === "#888") return true;

  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  return maxv - minv < 18;
}

function domPathKey(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== "svg") {
    const p = cur.parentElement;
    if (!p) break;
    const idx = Array.from(p.children).indexOf(cur);
    parts.push(`${cur.tagName.toLowerCase()}:${idx}`);
    cur = p;
  }
  return "p:" + parts.reverse().join("/");
}

// 经络候选线段：细、无填充、够长、有彩色 stroke
function looksMeridianSegment(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;
  if (isGrayOrBlack(stroke)) return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  if (sw <= 0 || sw > 1.4) return false;

  try {
    const anyEl = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 35) return false; // 线段级，不要太短
    }
  } catch {
    // ignore
  }

  return true;
}

function ensureStyleOnce() {
  const id = "__tcm_seg_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-26;} }
.seg-dim { opacity: 0.10; }
.seg-active {
  opacity: 1 !important;
  stroke-dasharray: 7 6;
  animation: tcmFlow 1.15s linear infinite;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-linecap: round;
  stroke-linejoin: round;
}
.seg-draft {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(255,160,80,0.75)) drop-shadow(0 0 14px rgba(255,160,80,0.45));
  stroke-dasharray: 4 6;
}
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activeSegKeys, draftSegKeys, onPickSeg }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");

  const activeSet = useMemo(() => new Set(activeSegKeys || []), [activeSegKeys]);
  const draftSet = useMemo(() => new Set(draftSegKeys || []), [draftSegKeys]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        setRaw("");
        const r = await fetch(src, { cache: "no-store" });
        if (!r.ok) {
          setErr(`SVG 读取失败：${r.status} ${r.statusText}（${src}）`);
          return;
        }
        const t = await r.text();
        if (!t.includes("<svg")) {
          setErr(`SVG 内容不像 SVG（${src}）——可能是 404 HTML。`);
          return;
        }
        if (!cancelled) setRaw(t);
      } catch (e: any) {
        setErr(`SVG 读取异常：${String(e?.message || e)}（${src}）`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // ✅ 默认所有都不可点（包括人体轮廓、文字、点）
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // ✅ 只挑“彩色细线段”做可点击 segment
    const candidates = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR)).filter(looksMeridianSegment);

    for (const el of candidates) {
      const key = domPathKey(el);
      el.setAttribute("data-segkey", key);
      el.classList.add("m-seg");
      (el as any).style.pointerEvents = "stroke";
      (el as any).style.cursor = "pointer";
    }

    const onClick = (evt: MouseEvent) => {
      const target = evt.target as Element | null;
      const hit = target?.closest(".m-seg") as SVGElement | null;
      if (!hit) return;
      const segKey = hit.getAttribute("data-segkey") || domPathKey(hit);
      onPickSeg?.({ segKey });
    };

    svg.addEventListener("click", onClick);
    return () => svg.removeEventListener("click", onClick);
  }, [raw, onPickSeg]);

  // highlight
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const segs = Array.from(svg.querySelectorAll<SVGElement>(".m-seg"));
    segs.forEach((el) => {
      el.classList.remove("seg-active");
      el.classList.remove("seg-dim");
      el.classList.remove("seg-draft");
    });

    if (activeSet.size === 0 && draftSet.size === 0) return;

    // dim everything first if anything active
    segs.forEach((el) => el.classList.add("seg-dim"));

    segs.forEach((el) => {
      const k = el.getAttribute("data-segkey") || "";
      if (draftSet.has(k)) {
        el.classList.remove("seg-dim");
        el.classList.add("seg-draft");
      }
      if (activeSet.has(k)) {
        el.classList.remove("seg-dim");
        el.classList.add("seg-active");
      }
    });
  }, [activeSet, draftSet]);

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


