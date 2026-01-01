"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type PickSeg = { segKey: string };
export type SvgMeta = {
  segments: Array<{ segKey: string; cx: number; cy: number; stroke?: string }>;
  labels: Array<{ text: string; cx: number; cy: number }>;
};

type Props = {
  src: string;
  activeSegKeys: string[];
  draftSegKeys?: string[];
  onPickSeg?: (pick: PickSeg) => void;
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
function isGrayOrBlack(stroke: string) {
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
function looksMeridianSegment(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;
  if (isGrayOrBlack(stroke)) return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  // 保留你原来的过滤逻辑
  if (sw <= 0 || sw > 1.6) return false;

  try {
    const anyEl = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 35) return false;
    }
  } catch {}

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

export default function InlineSvg({ src, activeSegKeys, draftSegKeys, onPickSeg, onMeta }: Props) {
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
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // viewBox / 适配
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

    // 全部先不可点
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // 删除韩文 text
    try {
      const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
      for (const t of texts) {
        const txt = (t.textContent || "").trim();
        if (txt && KOREAN_RE.test(txt)) t.remove();
      }
    } catch {}

    const candidates = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR)).filter(looksMeridianSegment);

    const segMeta: SvgMeta["segments"] = [];
    const labels: SvgMeta["labels"] = [];
    const cleanupFns: Array<() => void> = [];

    for (const el of candidates) {
      const key = domPathKey(el);

      // 原线：只负责视觉/动画
      el.setAttribute("data-segkey", key);
      el.classList.add("m-seg");
      (el as any).style.pointerEvents = "none";

      // 点击层：透明粗线，保证命中
      const hit = el.cloneNode(true) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("data-segkey", key);
      hit.setAttribute("stroke", "rgba(0,0,0,0)");
      hit.setAttribute("fill", "none");

      const sw = getStrokeWidth(el);
      const hitWidth = Math.max(10, sw * 8);
      hit.setAttribute("stroke-width", String(hitWidth));
      (hit as any).style.pointerEvents = "stroke";
      (hit as any).style.cursor = "pointer";

      // 插到原线前面，确保先点到 hit
      el.parentNode?.insertBefore(hit, el);

      // 直接绑 click（别再委托）
      const fn = (evt: Event) => {
        evt.preventDefault();
        evt.stopPropagation();
        onPickSeg?.({ segKey: key });
      };
      hit.addEventListener("click", fn);
      cleanupFns.push(() => hit.removeEventListener("click", fn));

      // meta
      try {
        const bb = (el as any).getBBox?.();
        if (bb && isFinite(bb.x) && isFinite(bb.y)) {
          segMeta.push({
            segKey: key,
            cx: bb.x + bb.width / 2,
            cy: bb.y + bb.height / 2,
            stroke: getStroke(el) || "",
          });
        }
      } catch {}
    }

    // 收集剩余 text（未来做英文标注用）
    try {
      const remainTexts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
      for (const t of remainTexts) {
        const txt = (t.textContent || "").trim();
        if (!txt) continue;
        const bb = (t as any).getBBox?.();
        if (bb && isFinite(bb.x) && isFinite(bb.y)) labels.push({ text: txt, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 });
      }
    } catch {}

    onMeta?.({ segments: segMeta, labels });

    return () => cleanupFns.forEach((f) => f());
  }, [raw, onPickSeg, onMeta]);

  // 动画高亮：只对 m-seg
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const segs = Array.from(svg.querySelectorAll<SVGElement>(".m-seg"));
    segs.forEach((el) => el.classList.remove("seg-active", "seg-dim", "seg-draft"));

    if (activeSet.size === 0 && draftSet.size === 0) return;

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

      <div ref={hostRef} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", maxWidth: "100%" }} />
    </div>
  );
}
