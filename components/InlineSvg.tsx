"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;
  groupKey: string;
  // 点击位置（SVG 坐标系）
  x: number;
  y: number;
};

type TitleHint = { id: string; text: string };

type Label = { code: string; name: string };

type Props = {
  src: string;

  // 当前高亮（由上层控制）
  activePick: ActivePick | null;

  // 当前经络要显示的穴位标签（由上层传）
  labels: Label[];

  // 供自动识别：SVG 里的经络标题 text
  titles?: TitleHint[];

  // 点击经络线时回调（会带一个 hintMeridianId）
  onPick?: (pick: ActivePick, hintMeridianId: string | null) => void;
};

const SHAPE_SELECTOR = "path, polyline, line";

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function ensureStyleOnce() {
  const id = "__tcm_inline_svg_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmFlow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -26; }
}
.tcm-dim { opacity: 0.12; }
.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-dasharray: 7 6;
  animation: tcmFlow 1.15s linear infinite;
}
`;
  document.head.appendChild(style);
}

function centerBBox(el: SVGGraphicsElement) {
  const b = el.getBBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// 用 DOM 路径做稳定 key（不靠 id）
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

// 经络候选线：细、无填充、够长、有 stroke
function looksMeridian(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke =
    (el.getAttribute("stroke") ||
      (el.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] ||
      "").trim();
  if (!stroke || stroke === "none") return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const swRaw =
    el.getAttribute("stroke-width") ||
    (el.getAttribute("style") || "").match(/stroke-width:\s*([^;]+)/i)?.[1] ||
    "";
  const sw = parseFloat(String(swRaw).replace("px", "")) || 0;
  if (sw <= 0 || sw > 1.2) return false;

  // 长度过滤
  try {
    const anyEl = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 120) return false;
    }
  } catch {
    return false;
  }

  return true;
}

export default function InlineSvg({ src, activePick, labels, titles, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState("");

  const titleCentersRef = useRef<Array<{ id: string; x: number; y: number }>>([]);

  // load svg
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      const text = await res.text();
      if (!cancelled) setSvgRaw(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // inject + tag clickable meridians + build title centers
  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = svgRaw || "";

    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // overlay for labels
    let overlay = svg.querySelector("#__tcm_overlay__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__tcm_overlay__");
      svg.appendChild(overlay);
    } else {
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // 禁止所有元素抢点击：先全 none
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // 标记经络候选线，并允许点击
    const lines = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    lines.forEach((el) => {
      if (!looksMeridian(el)) return;
      el.classList.add("tcm-meridian");
      (el as any).style.pointerEvents = "stroke";
      el.setAttribute("data-groupkey", domPathKey(el.closest("g") ?? el));
      const stroke =
        (el.getAttribute("stroke") ||
          (el.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] ||
          "").trim();
      el.setAttribute("data-stroke", norm(stroke));
    });

    // 构建标题坐标（用于自动识别）
    titleCentersRef.current = [];
    if (titles && titles.length) {
      const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
      for (const t of textNodes) {
        const s = (t.textContent || "").trim();
        const hit = titles.find((x) => x.text === s);
        if (!hit) continue;
        const c = centerBBox(t as any);
        titleCentersRef.current.push({ id: hit.id, x: c.x, y: c.y });
      }
    }
  }, [svgRaw, titles]);

  // apply highlight + render labels along the active path
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const overlay = svg.querySelector("#__tcm_overlay__") as SVGGElement | null;
    if (!overlay) return;
    overlay.innerHTML = "";

    const all = Array.from(svg.querySelectorAll<SVGElement>(".tcm-meridian"));
    all.forEach((el) => {
      el.classList.remove("tcm-active");
      el.classList.remove("tcm-dim");
    });

    if (!activePick) return;

    // dim others
    all.forEach((el) => el.classList.add("tcm-dim"));

    // activate same groupKey+stroke
    all.forEach((el) => {
      const gk = el.getAttribute("data-groupkey") || "";
      const st = el.getAttribute("data-stroke") || "";
      if (gk === activePick.groupKey && st === activePick.stroke) {
        el.classList.remove("tcm-dim");
        el.classList.add("tcm-active");
      }
    });

    // labels on image: sample along the longest matching path
    if (!labels || labels.length === 0) return;

    const candidates = Array.from(svg.querySelectorAll<SVGPathElement>("path.tcm-meridian")).filter((p) => {
      return (
        (p.getAttribute("data-groupkey") || "") === activePick.groupKey &&
        (p.getAttribute("data-stroke") || "") === activePick.stroke
      );
    });

    let rep: SVGPathElement | null = null;
    let bestLen = -1;
    for (const p of candidates) {
      try {
        const len = p.getTotalLength();
        if (len > bestLen) {
          bestLen = len;
          rep = p;
        }
      } catch {}
    }
    if (!rep || bestLen < 10) return;

    // font size in svg units ~ 11px
    const vb = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    const scale = vb && rect.width ? vb.width / rect.width : 1;
    const fontSize = 11 * scale;
    const strokeW = 3 * scale;

    const show = labels.slice(0, 12);
    const start = bestLen * 0.12;
    const end = bestLen * 0.88;

    for (let i = 0; i < show.length; i++) {
      const t = show.length === 1 ? 0.5 : i / (show.length - 1);
      const at = start + (end - start) * t;

      let pt: DOMPoint | null = null;
      try {
        pt = rep.getPointAtLength(at);
      } catch {
        pt = null;
      }
      if (!pt) continue;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(pt.x));
      text.setAttribute("y", String(pt.y));
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", String(strokeW));
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${show[i].code} ${show[i].name}`;
      overlay.appendChild(text);
    }
  }, [activePick, labels]);

  // click handler
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const target = e.target as Element | null;
    const hit = target?.closest(".tcm-meridian") as SVGGraphicsElement | null;
    if (!hit) return;

    const gk = hit.getAttribute("data-groupkey") || domPathKey(hit.closest("g") ?? hit);
    const stroke = hit.getAttribute("data-stroke") || norm(hit.getAttribute("stroke") || "");

    const c = centerBBox(hit as any);
    const pick: ActivePick = { groupKey: gk, stroke, x: c.x, y: c.y };

    // nearest title => hint meridian id
    let hint: string | null = null;
    const titleCenters = titleCentersRef.current;
    if (titleCenters.length) {
      let best = Infinity;
      for (const t of titleCenters) {
        const d = dist2({ x: pick.x, y: pick.y }, t);
        if (d < best) {
          best = d;
          hint = t.id;
        }
      }
      // 阈值：太远就当不确定
      if (best > 2600) hint = null;
    }

    onPick?.(pick, hint);
  };

  return (
    <div
      ref={hostRef}
      onClick={handleClick}
      style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}
    />
  );
}


