"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;   // normalized
  groupKey: string; // stable-ish dom path
};

type TitleHint = { id: string; text: string };

type Props = {
  src: string;

  activePick: ActivePick | null;
  labels: Array<{ code: string; name: string }>;

  titles?: TitleHint[];

  // 点击经络线：回传 pick + “最近标题”推断的经络 id（可能为 null）
  onPick?: (pick: ActivePick, hintMeridianId: string | null) => void;

  // SVG ready 后，把“标题中心”+“经络候选线”发给上层，用来自动绑定按钮↔经络
  onReady?: (api: {
    svg: SVGSVGElement;
    meridianEls: SVGElement[];
    titleCenters: Array<{ id: string; x: number; y: number }>;
    getPickFromEl: (el: SVGElement) => ActivePick;
    getCenterOfEl: (el: SVGElement) => { x: number; y: number };
  }) => void;
};

const SHAPE_SELECTOR = "path, polyline, line";

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

// 黑灰色判断：人体轮廓/血管/辅助线经常是黑/灰
function isGrayOrBlack(stroke: string) {
  const s = norm(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;
  // 常见灰
  if (s === "#8c8e91" || s === "#a9b5bf" || s === "#666" || s === "#777" || s === "#888") return true;

  // rgb(...) 判灰
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  return maxv - minv < 18; // 接近灰
}

function ensureStyleOnce() {
  const id = "__tcm_inline_svg_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-26;} }
.tcm-dim { opacity: 0.10; }
.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-dasharray: 7 6;
  animation: tcmFlow 1.15s linear infinite;
  stroke-linecap: round;
  stroke-linejoin: round;
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

// 经络候选线：细、无填充、够长、有 stroke、且 stroke 不是黑灰
function looksMeridian(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;

  // ✅ 关键：黑/灰的一律排除 —— 这就是“人体轮廓不能点”的核心
  if (isGrayOrBlack(stroke)) return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  if (sw <= 0 || sw > 1.2) return false;

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

export default function InlineSvg({ src, activePick, labels, titles, onPick, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState("");

  const titleCentersRef = useRef<Array<{ id: string; x: number; y: number }>>([]);

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

  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = svgRaw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // overlay
    let overlay = svg.querySelector("#__tcm_overlay__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__tcm_overlay__");
      svg.appendChild(overlay);
    } else {
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // ✅ 全部禁点，避免人体/文字/点抢点击
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // 标记经络候选线（只有彩色细线）
    const meridianEls: SVGElement[] = [];
    const lines = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    for (const el of lines) {
      if (!looksMeridian(el)) continue;
      el.classList.add("tcm-meridian");
      (el as any).style.pointerEvents = "stroke";
      el.setAttribute("data-groupkey", domPathKey(el.closest("g") ?? el));
      el.setAttribute("data-stroke", norm(getStroke(el)));
      meridianEls.push(el);
    }

    // 标题中心（用于自动推断是哪条经）
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

    onReady?.({
      svg,
      meridianEls,
      titleCenters: titleCentersRef.current,
      getPickFromEl: (el) => ({
        groupKey: el.getAttribute("data-groupkey") || domPathKey(el.closest("g") ?? el),
        stroke: el.getAttribute("data-stroke") || norm(getStroke(el)),
      }),
      getCenterOfEl: (el) => centerBBox(el as any),
    });
  }, [svgRaw, titles, onReady]);

  // highlight + labels
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

    all.forEach((el) => el.classList.add("tcm-dim"));

    all.forEach((el) => {
      const gk = el.getAttribute("data-groupkey") || "";
      const st = el.getAttribute("data-stroke") || "";
      if (gk === activePick.groupKey && st === activePick.stroke) {
        el.classList.remove("tcm-dim");
        el.classList.add("tcm-active");
      }
    });

    if (!labels || labels.length === 0) return;

    // pick one representative path to place labels
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const target = e.target as Element | null;
    const hit = target?.closest(".tcm-meridian") as SVGGraphicsElement | null;
    if (!hit) return;

    const pick: ActivePick = {
      groupKey: hit.getAttribute("data-groupkey") || domPathKey(hit.closest("g") ?? hit),
      stroke: hit.getAttribute("data-stroke") || norm(getStroke(hit)),
    };

    // nearest title => hint
    let hint: string | null = null;
    const tc = centerBBox(hit as any);
    const titleCenters = titleCentersRef.current;

    if (titleCenters.length) {
      let best = Infinity;
      for (const t of titleCenters) {
        const d = dist2(tc, t);
        if (d < best) {
          best = d;
          hint = t.id;
        }
      }
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



