"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;   // normalized
  groupKey: string; // TOP-LEVEL group key (stable, prevents cross-meridian bleed)
};

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

// 判定灰/黑：人体轮廓通常是灰黑色线（防止被当成经络线）
function isGrayishStroke(stroke: string) {
  const s = norm(stroke);
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  // 颜色差很小 => 灰度
  return (maxv - minv) < 18;
}

// 找到 layer1 下的“顶层 g”，用它做 groupKey，避免点右边经络跑到左边穴位点
function topGroupKey(el: Element): string {
  let cur: Element | null = el;
  let lastG: Element | null = null;

  while (cur) {
    if (cur.tagName.toLowerCase() === "g") lastG = cur;
    if ((cur as any).getAttribute?.("id") === "layer1") break;
    cur = cur.parentElement;
  }

  // lastG 可能就是 layer1 下面第一层的 g
  if (lastG && (lastG as any).getAttribute) {
    // 用 id 优先，没有就用 DOM 路径
    const id = (lastG as any).getAttribute("id");
    if (id) return `g:${id}`;
  }

  // fallback: DOM path
  const parts: string[] = [];
  cur = el;
  while (cur && cur.tagName.toLowerCase() !== "svg") {
    const p = cur.parentElement;
    if (!p) break;
    const idx = Array.from(p.children).indexOf(cur);
    parts.push(`${cur.tagName.toLowerCase()}:${idx}`);
    cur = p;
  }
  return "p:" + parts.reverse().join("/");
}

function stripSvgText(svg: string) {
  // 你不要韩文/旧标签，我直接删掉原始 <text>
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
  50%  { filter: drop-shadow(0 0 5px rgba(255,255,255,0.50)) drop-shadow(0 0 12px rgba(255,255,255,0.75)); }
  100% { filter: drop-shadow(0 0 1px rgba(255,255,255,0.20)) drop-shadow(0 0 2px rgba(255,255,255,0.25)); }
}
.tcm-glow { animation: tcmGlowPulse 1.15s ease-in-out infinite; }
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState("");
  const [ready, setReady] = useState(false);

  const onPickRef = useRef<Props["onPick"]>(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // 1) load svg
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      let text = await res.text();
      text = stripSvgText(text);
      if (!cancelled) setSvgRaw(text);
    })();
    return () => { cancelled = true; };
  }, [src]);

  // 2) inject svg DOM (only when svgRaw changes) —— 不会“点一下闪一下回原样”
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    ensureGlowStyleOnce();

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));

    const svg = host.querySelector("svg");
    if (!svg) return;

    // overlay group
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // 强制标签可见
    let styleEl = svg.querySelector("#__tcm_internal_style__") as SVGStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.setAttribute("id", "__tcm_internal_style__");
      svg.prepend(styleEl);
    }
    styleEl.textContent = `
#__acupoint_labels__ text{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:none!important;
}
`;

    // Tag + make ONLY meridian lines + circles clickable
    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    nodes.forEach((el) => {
      const tag = el.tagName.toLowerCase();

      // 默认都不可点：彻底解决“还能选中人体”
      (el.style as any).pointerEvents = "none";

      // image(人体底图) 永远不可点
      if (tag === "image") {
        el.dataset.kind = "body";
        return;
      }

      const cs = window.getComputedStyle(el);
      const stroke = norm(cs.stroke || "");
      const fill = cs.fill || "";
      const sw = parseFloat(cs.strokeWidth || "0");

      el.dataset.stroke = stroke;
      el.dataset.groupKey = topGroupKey(el);
      el.dataset.origSw = cs.strokeWidth || "";

      // 穴位点：circle 可点
      if (tag === "circle") {
        el.dataset.kind = "dot";
        (el.style as any).pointerEvents = "all";
        return;
      }

      // 经络线候选：必须有 stroke、fill 透明、非灰黑、线宽合理
      const isMeridian =
        hasStroke(stroke) &&
        fillTransparent(fill) &&
        !isGrayishStroke(stroke) &&
        isFinite(sw) &&
        sw > 0 &&
        sw <= 4;

      if (isMeridian) {
        el.dataset.kind = "meridian";
        (el.style as any).pointerEvents = "stroke";
      } else {
        el.dataset.kind = "body";
      }
    });
  }, [svgRaw]);

  function getSvg() {
    const host = hostRef.current;
    if (!host) return null;
    return host.querySelector("svg") as SVGSVGElement | null;
  }

  function pickRepresentativePath(svg: SVGSVGElement, groupKey: string, stroke: string) {
    // 同一个 groupKey 里找“最长的 path”作为代表线（避免你点到点/短线导致不显示）
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
        if (len > bestLen) { bestLen = len; best = p; }
      } catch {}
    }
    return best;
  }

  // 3) highlight + labels (THIS fixes “穴位名一直不显示”：坐标系转 CTM)
  useEffect(() => {
    if (!ready) return;
    const svg = getSvg();
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    // reset (only for meridian+dot; body untouched)
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

    // 高亮规则：只高亮同 groupKey 同 stroke 的 meridian；点只保留同组，其他组直接隐藏（不串）
    nodes.forEach((el) => {
      const kind = el.dataset.kind;

      if (kind !== "meridian" && kind !== "dot") return;

      const sameGroup = (el.dataset.groupKey || "") === groupKey;

      if (kind === "dot") {
        el.style.opacity = sameGroup ? "0.25" : "0";
        return;
      }

      // meridian
      const sameStroke = (el.dataset.stroke || "") === stroke;
      const ok = sameGroup && sameStroke;

      if (ok) {
        el.style.opacity = "1";
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) el.style.strokeWidth = String(orig + 1);
        el.classList.add("tcm-glow");
      } else {
        el.style.opacity = "0.08";
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // draw labels along representative path (with CTM transform)
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    const rep = pickRepresentativePath(svg, groupKey, stroke);
    if (!rep) return;

    let total = 0;
    try { total = rep.getTotalLength(); } catch { return; }
    if (!isFinite(total) || total <= 10) return;

    const ctm = rep.getCTM();
    if (!ctm) return;

    const show = labels.slice(0, 12);
    const start = total * 0.1;
    const end = total * 0.9;

    const svgPoint = svg.createSVGPoint();

    show.forEach((p, idx) => {
      const t = show.length === 1 ? 0.5 : idx / (show.length - 1);
      const len = start + (end - start) * t;

      let local: DOMPoint | null = null;
      try { local = rep.getPointAtLength(len); } catch { local = null; }
      if (!local) return;

      // ✅ 关键：把路径局部坐标变换到 SVG 全局坐标
      svgPoint.x = local.x;
      svgPoint.y = local.y;
      const global = svgPoint.matrixTransform(ctm);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(global.x));
      text.setAttribute("y", String(global.y));
      text.setAttribute("font-size", "16");
      text.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "4");
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${p.code} ${p.zh}`;
      overlay.appendChild(text);
    });
  }, [ready, activePick, labels]);

  // click handler: ignore body; dot maps to nearest meridian in same top group+stroke
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svg = getSvg();
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const hit = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!hit) return;

    const kind = hit.dataset.kind;

    // ✅ 彻底禁止人体被选中
    if (kind !== "meridian" && kind !== "dot") return;

    const groupKey = hit.dataset.groupKey || topGroupKey(hit);

    if (kind === "meridian") {
      const stroke = hit.dataset.stroke || norm(window.getComputedStyle(hit).stroke);
      if (!hasStroke(stroke)) return;
      onPickRef.current?.({ stroke: norm(stroke), groupKey });
      return;
    }

    // dot -> map to same groupKey, same stroke representative path
    const dotStroke = hit.dataset.stroke || norm(window.getComputedStyle(hit).stroke);
    if (!hasStroke(dotStroke)) return;

    const rep = pickRepresentativePath(svg, groupKey, norm(dotStroke));
    if (!rep) return;

    const stroke = rep.dataset.stroke || norm(window.getComputedStyle(rep).stroke);
    if (!hasStroke(stroke)) return;

    onPickRef.current?.({ stroke: norm(stroke), groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        已修：点不到人体；不串穴位点；选中后图上会显示穴位名（坐标系已纠正）。
      </div>
      <div
        ref={hostRef}
        onClick={handleClick}
        style={{ borderRadius: 10, border: "1px solid #eee", overflow: "hidden" }}
      />
    </div>
  );
}




