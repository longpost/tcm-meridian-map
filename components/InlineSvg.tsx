"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type ActivePick = { stroke: string; groupKey: string };
type AcupointLabel = { code: string; zh: string };

type Props = {
  src: string;
  activePick: ActivePick | null;
  labels: AcupointLabel[];
  onPick?: (p: ActivePick) => void;
};

const SHAPE = "path, polyline, line, circle, rect, ellipse";

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

function domPathKey(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== "svg") {
    const parent = cur.parentElement;
    if (!parent) break;
    const idx = Array.from(parent.children).indexOf(cur);
    parts.push(`${cur.tagName.toLowerCase()}:${idx}`);
    cur = parent;
  }
  return "p:" + parts.reverse().join("/");
}

function hasStroke(stroke: string) {
  const s = norm(stroke);
  return s && s !== "none" && s !== "rgba(0,0,0,0)";
}

function transparentFill(fill: string) {
  const f = norm(fill);
  return f === "none" || f === "transparent" || f === "rgba(0,0,0,0)";
}

// 排除接近黑色（人体轮廓常见）
function isNearBlack(stroke: string) {
  const s = norm(stroke);
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  return r < 35 && g < 35 && b < 35;
}

function ensureStylesOnce() {
  const id = "__tcm_inline_svg_styles__";
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

function stripSvgText(svg: string) {
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // keep callback stable without re-triggering effects
  const onPickRef = useRef<Props["onPick"]>(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // 1) load svg (string)
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

  // 2) inject DOM ONLY when svgRaw changes (this is what stops the “flash then reset”)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    ensureStylesOnce();

    host.innerHTML = svgRaw || "";
    setMounted(Boolean(svgRaw));

    const svg = host.querySelector("svg");
    if (!svg) return;

    // overlay for labels on top
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // force our label visible even if SVG has hostile CSS
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

    // mark clickability + dataset
    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE));

    nodes.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const stroke = norm(cs.stroke || "");
      const fill = cs.fill || "";
      const sw = parseFloat(cs.strokeWidth || "0");
      const group = el.closest("g") ?? el;

      el.dataset.stroke = stroke;
      el.dataset.groupKey = domPathKey(group);
      el.dataset.origSw = cs.strokeWidth || "";

      // default: NOT clickable (so body/outline can't be selected)
      (el.style as any).pointerEvents = "none";
      el.dataset.isMeridian = "0";
      el.dataset.isDot = "0";

      // meridian candidate: colored stroke + transparent fill + not near black + reasonable stroke width
      const isMeridian =
        el.tagName.toLowerCase() !== "circle" &&
        hasStroke(stroke) &&
        transparentFill(fill) &&
        !isNearBlack(stroke) &&
        isFinite(sw) &&
        sw > 0 &&
        sw <= 4;

      if (isMeridian) {
        el.dataset.isMeridian = "1";
        (el.style as any).pointerEvents = "stroke";
      }

      // allow dots clickable (but we will map dot->line in click handler)
      if (el.tagName.toLowerCase() === "circle") {
        el.dataset.isDot = "1";
        (el.style as any).pointerEvents = "all";
      }

      // reset visuals
      el.classList.remove("tcm-glow");
      el.style.opacity = "";
      el.style.strokeWidth = "";
      el.style.filter = "";
    });
  }, [svgRaw]);

  const activeStroke = useMemo(() => (activePick ? norm(activePick.stroke) : null), [activePick]);
  const activeGroup = useMemo(() => (activePick ? activePick.groupKey : null), [activePick]);

  function getSvg() {
    const host = hostRef.current;
    if (!host) return null;
    return host.querySelector("svg") as SVGSVGElement | null;
  }

  function pickLongestPathInGroup(svg: SVGSVGElement, groupKey: string) {
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path")).filter(
      (p) => p.dataset.isMeridian === "1" && (p.dataset.groupKey || "") === groupKey
    );
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

  // 3) apply highlight WITHOUT re-initializing anything (no flash)
  useEffect(() => {
    if (!mounted) return;
    const svg = getSvg();
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE));
    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    // no active -> restore only meridian/dots (leave body untouched)
    if (!activePick || !activeStroke || !activeGroup) {
      nodes.forEach((el) => {
        if (el.dataset.isMeridian === "1" || el.dataset.isDot === "1") {
          el.style.opacity = "";
          el.style.strokeWidth = "";
          el.classList.remove("tcm-glow");
          el.style.filter = "";
        }
      });
      return;
    }

    // highlight only same group + same stroke meridian lines
    const matchedMeridians = nodes.filter(
      (el) =>
        el.dataset.isMeridian === "1" &&
        (el.dataset.groupKey || "") === activeGroup &&
        (el.dataset.stroke || "") === activeStroke
    );

    nodes.forEach((el) => {
      const isMeridian = el.dataset.isMeridian === "1";
      const isDot = el.dataset.isDot === "1";

      if (!isMeridian && !isDot) return; // body/outline untouched

      const sameGroup = (el.dataset.groupKey || "") === activeGroup;

      if (isMeridian) {
        const ok =
          sameGroup && (el.dataset.stroke || "") === activeStroke && matchedMeridians.length > 0;
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
      }

      // dots: hide other groups completely to stop “左边点也出来”
      if (isDot) {
        el.style.opacity = sameGroup ? "0.25" : "0";
      }
    });

    // draw labels along the longest path in active group
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    const rep = pickLongestPathInGroup(svg, activeGroup);
    if (!rep) return;

    let total = 0;
    try {
      total = rep.getTotalLength();
    } catch {
      return;
    }
    if (!isFinite(total) || total <= 10) return;

    const show = labels.slice(0, 12);
    const start = total * 0.1;
    const end = total * 0.9;

    show.forEach((p, idx) => {
      const t = show.length === 1 ? 0.5 : idx / (show.length - 1);
      const len = start + (end - start) * t;
      let pt: DOMPoint | null = null;
      try {
        pt = rep.getPointAtLength(len);
      } catch {
        pt = null;
      }
      if (!pt) return;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(pt.x));
      text.setAttribute("y", String(pt.y));
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
  }, [mounted, activePick, activeStroke, activeGroup, labels]);

  // click -> meridian line OR dot maps to meridian line in same group
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svg = getSvg();
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const hit = target.closest(SHAPE) as SVGElement | null;
    if (!hit) return;

    // body shouldn't be clickable now, but just in case:
    if (hit.dataset.isMeridian !== "1" && hit.dataset.isDot !== "1") return;

    const groupKey = hit.dataset.groupKey || domPathKey(hit.closest("g") ?? hit);

    let picked: SVGElement | null = null;

    if (hit.dataset.isMeridian === "1") {
      picked = hit;
    } else if (hit.tagName.toLowerCase() === "circle") {
      picked = pickLongestPathInGroup(svg, groupKey);
    }

    if (!picked) return;
    const stroke = picked.dataset.stroke || norm(window.getComputedStyle(picked).stroke);
    if (!hasStroke(stroke)) return;

    onPickRef.current?.({ stroke: norm(stroke), groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        修复：不闪；点不到人体；穴位点不串；穴位名会画在图上（最多 12 个）。
      </div>
      <div
        ref={hostRef}
        onClick={handleClick}
        style={{ borderRadius: 10, border: "1px solid #eee", overflow: "hidden" }}
      />
    </div>
  );
}




