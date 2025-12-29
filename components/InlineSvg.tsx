"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = { stroke: string; groupKey: string };
type AcupointLabel = { code: string; zh: string };

type Props = {
  src: string;
  activePick: ActivePick | null;
  labels: AcupointLabel[];
  onPick?: (p: ActivePick) => void;
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse, image";

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}
function hasStroke(stroke: string) {
  const s = norm(stroke);
  return s && s !== "none" && s !== "rgba(0,0,0,0)";
}
function fillTransparent(fill: string) {
  const f = norm(fill);
  return f === "none" || f === "transparent" || f === "rgba(0,0,0,0)";
}
// 灰/黑一般是人体轮廓，不当经络
function isGrayishStroke(stroke: string) {
  const s = norm(stroke);
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  return maxv - minv < 18;
}

function stripSvgText(svg: string) {
  // 删掉原 SVG 的文字（韩文/旧标注）
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

function ensureGlowStyleOnce() {
  const id = "__tcm_glow_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmGlowPulse {
  0%   { filter: drop-shadow(0 0 1px rgba(255,255,255,0.20)) drop-shadow(0 0 2px rgba(255,255,255,0.25)); }
  50%  { filter: drop-shadow(0 0 4px rgba(255,255,255,0.45)) drop-shadow(0 0 10px rgba(255,255,255,0.70)); }
  100% { filter: drop-shadow(0 0 1px rgba(255,255,255,0.20)) drop-shadow(0 0 2px rgba(255,255,255,0.25)); }
}
.tcm-glow { animation: tcmGlowPulse 1.15s ease-in-out infinite; }
`;
  document.head.appendChild(style);
}

function looksMeridian(el: SVGElement) {
  const cs = window.getComputedStyle(el);
  const stroke = norm(cs.stroke || "");
  const fill = cs.fill || "";
  const sw = parseFloat(cs.strokeWidth || "0");
  if (!hasStroke(stroke)) return false;
  if (!fillTransparent(fill)) return false;
  if (isGrayishStroke(stroke)) return false;
  if (!isFinite(sw) || sw <= 0 || sw > 4) return false;
  return true;
}

// 找一个“更紧”的祖先 g：内部经络线只有 1 种颜色，避免串组
function findTightMeridianGroup(svg: SVGSVGElement, el: Element): SVGGElement | null {
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== "svg") {
    if (cur.tagName.toLowerCase() === "g") {
      const g = cur as SVGGElement;
      const segs = Array.from(g.querySelectorAll<SVGElement>("path,polyline,line")).filter((x) =>
        looksMeridian(x)
      );
      if (segs.length) {
        const strokes = new Set(
          segs.map((p) => {
            const ds = (p as any).dataset?.stroke;
            return ds ? ds : norm(window.getComputedStyle(p).stroke);
          })
        );
        if (strokes.size === 1) return g;
      }
    }
    cur = cur.parentElement;
  }
  return null;
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

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState("");
  const [ready, setReady] = useState(false);

  const onPickRef = useRef<Props["onPick"]>(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // load svg
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      let text = await res.text();
      text = stripSvgText(text);
      if (!cancelled) setSvgRaw(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // inject DOM (不会闪回)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    ensureGlowStyleOnce();

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));

    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // overlay 放最后，保证在最上层
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    } else {
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // force label visible
    let styleEl = svg.querySelector("#__tcm_internal_style__") as SVGStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.setAttribute("id", "__tcm_internal_style__");
      svg.prepend(styleEl);
    }
    styleEl.textContent = `
#__acupoint_labels__ text{
  display:block!important; visibility:visible!important; opacity:1!important;
  pointer-events:none!important;
}
`;

    // tag + pointer-events: 只让经络线可点；穴位点/人体全部不可点
    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    nodes.forEach((el) => {
      const tag = el.tagName.toLowerCase();

      // 默认全部不可点 => 人体永远点不到
      (el.style as any).pointerEvents = "none";
      el.dataset.kind = "body";

      if (tag === "image") return;

      const cs = window.getComputedStyle(el);
      el.dataset.stroke = norm(cs.stroke || "");
      el.dataset.origSw = cs.strokeWidth || "";

      // tighter groupKey（防串）
      const g = findTightMeridianGroup(svg, el) || (el.closest("g") as SVGGElement | null);
      el.dataset.groupKey = g ? (g.getAttribute("id") ? `g:${g.getAttribute("id")}` : domPathKey(g)) : domPathKey(el);

      // 穴位点：不可点（你要取消）
      if (tag === "circle") {
        el.dataset.kind = "dot";
        return;
      }

      // 经络线：可点
      if (looksMeridian(el)) {
        el.dataset.kind = "meridian";
        (el.style as any).pointerEvents = "stroke";
      }
    });
  }, [svgRaw]);

  function getSvg() {
    const host = hostRef.current;
    if (!host) return null;
    return host.querySelector("svg") as SVGSVGElement | null;
  }

  function pickRepPath(svg: SVGSVGElement, groupKey: string, stroke: string): SVGPathElement | null {
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path")).filter((p) => {
      return (
        p.dataset.kind === "meridian" &&
        (p.dataset.groupKey || "") === groupKey &&
        (p.dataset.stroke || "") === stroke
      );
    });
    let best: SVGPathElement | null = null;
    let bestLen = -1;
    for (const p of paths) {
      try {
        const len = p.getTotalLength();
        if (len > bestLen) {
          bestLen = len;
          best = p;
        }
      } catch {}
    }
    return best;
  }

  // highlight + labels
  useEffect(() => {
    if (!ready) return;
    const svg = getSvg();
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    // reset
    if (!activePick) {
      nodes.forEach((el) => {
        if (el.dataset.kind === "meridian" || el.dataset.kind === "dot") {
          el.style.opacity = "";
          el.style.strokeWidth = "";
          el.classList.remove("tcm-glow");
          el.style.filter = "";
        }
      });
      return;
    }

    const groupKey = activePick.groupKey;
    const stroke = norm(activePick.stroke);

    nodes.forEach((el) => {
      const kind = el.dataset.kind;
      if (kind !== "meridian" && kind !== "dot") return;

      // ✅ 穴位点全部隐藏（避免“亮一堆点”烦你）
      if (kind === "dot") {
        el.style.opacity = "0";
        return;
      }

      const sameGroup = (el.dataset.groupKey || "") === groupKey;
      const ok = sameGroup && (el.dataset.stroke || "") === stroke;

      if (ok) {
        el.style.opacity = "1";
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) el.style.strokeWidth = String(orig + 1);
        el.classList.add("tcm-glow");
      } else {
        el.style.opacity = "0.07";
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // labels: only when labels exist
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    const rep = pickRepPath(svg, groupKey, stroke);
    if (!rep) return;

    let total = 0;
    try { total = rep.getTotalLength(); } catch { return; }
    if (!isFinite(total) || total <= 10) return;

    const ctm = rep.getCTM();
    if (!ctm) return;

    // ✅ 字体按“像素”折算成 svg 单位，避免巨型字
    const vb = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    const scale = vb && rect.width ? (vb.width / rect.width) : 1; // svg单位/像素
    const fontSize = 11 * scale; // ~11px
    const strokeW = 3 * scale;

    const show = labels.slice(0, 10);
    const start = total * 0.12;
    const end = total * 0.88;

    const sp = svg.createSVGPoint();

    show.forEach((p, idx) => {
      const t = show.length === 1 ? 0.5 : idx / (show.length - 1);
      const len = start + (end - start) * t;

      let local: DOMPoint | null = null;
      try { local = rep.getPointAtLength(len); } catch { local = null; }
      if (!local) return;

      sp.x = local.x;
      sp.y = local.y;
      const global = sp.matrixTransform(ctm);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(global.x));
      text.setAttribute("y", String(global.y));
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", String(strokeW));
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${p.code} ${p.zh}`;
      overlay.appendChild(text);
    });
  }, [ready, activePick, labels]);

  // click: only meridian lines
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svg = getSvg();
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const hit = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!hit) return;

    if (hit.dataset.kind !== "meridian") return;

    const stroke = hit.dataset.stroke || norm(window.getComputedStyle(hit).stroke);
    if (!hasStroke(stroke)) return;

    const groupKey = hit.dataset.groupKey || domPathKey(hit.closest("g") ?? hit);

    onPickRef.current?.({ stroke: norm(stroke), groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        点线会触发右侧联动（page.tsx）；穴位点不显示不参与点击；穴位名字号按屏幕固定，不会巨大。
      </div>
      <div
        ref={hostRef}
        onClick={handleClick}
        style={{ borderRadius: 10, border: "1px solid #eee", overflow: "hidden" }}
      />
    </div>
  );
}


