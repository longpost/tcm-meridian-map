"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;     // normalized computed stroke
  groupKey: string;   // stable DOM-path key
};

type AcupointLabel = { code: string; zh: string };

type Props = {
  src: string;
  activePick: ActivePick | null;
  labels: AcupointLabel[]; // selected meridian points (may be empty)
  onPick?: (info: ActivePick) => void;
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse";

function stripSvgTextLabels(svg: string) {
  // remove existing text nodes to avoid flicker; not enough alone, but helps
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

// Make a stable group key even if <g> has no id: use DOM ancestry indices up to <svg>
function domPathKey(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;

  while (cur && cur.tagName.toLowerCase() !== "svg") {
    const parent = cur.parentElement;
    if (!parent) break;
    const children = Array.from(parent.children);
    const idx = children.indexOf(cur);
    parts.push(`${cur.tagName.toLowerCase()}:${idx}`);
    cur = parent;
  }

  // reverse so it's root->leaf
  return "p:" + parts.reverse().join("/");
}

// Detect “almost black/gray” strokes (common for body outline)
function isDarkStroke(stroke: string) {
  const s = norm(stroke);
  if (s === "black" || s === "#000" || s === "#000000") return true;
  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
  return r < 40 && g < 40 && b < 40; // near-black
}

// Ensure glowing animation + label visibility even if SVG has text{display:none}
function ensureGlobalStyleOnce() {
  const id = "__tcm_svg_interact_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmGlowPulse {
  0%   { filter: drop-shadow(0 0 1px rgba(255,255,255,0.20)) drop-shadow(0 0 2px rgba(255,255,255,0.25)); }
  50%  { filter: drop-shadow(0 0 3px rgba(255,255,255,0.40)) drop-shadow(0 0 8px rgba(255,255,255,0.65)); }
  100% { filter: drop-shadow(0 0 1px rgba(255,255,255,0.20)) drop-shadow(0 0 2px rgba(255,255,255,0.25)); }
}
.tcm-glow { animation: tcmGlowPulse 1.15s ease-in-out infinite; }
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState<string>("");
  const [ready, setReady] = useState(false);

  // Load SVG text
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      let text = await res.text();
      text = stripSvgTextLabels(text);
      if (!cancelled) setSvgRaw(text);
    })();
    return () => { cancelled = true; };
  }, [src]);

  // Inject SVG DOM once per svgRaw
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    ensureGlobalStyleOnce();

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));

    const svg = host.querySelector("svg");
    if (!svg) return;

    // Add internal style to force our labels visible even if SVG has text{display:none}
    let internal = svg.querySelector("#__tcm_internal_style__") as SVGStyleElement | null;
    if (!internal) {
      internal = document.createElementNS("http://www.w3.org/2000/svg", "style");
      internal.setAttribute("id", "__tcm_internal_style__");
      svg.prepend(internal);
    }
    internal.textContent = `
#__acupoint_labels__ text {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
}
`;
  }, [svgRaw]);

  // Initialize datasets + pointer-events rules (THIS is what stops selecting the body)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    // Create overlay group for labels
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // Decide clickability:
    // - Meridian lines: stroke exists, fill transparent, not dark, strokeWidth small-ish
    // - Acupoint dots: circles are clickable but will be mapped to a meridian path in same group
    nodes.forEach((el) => {
      const cs = window.getComputedStyle(el);
      const stroke = norm(cs.stroke || "");
      const fill = norm(cs.fill || "");
      const sw = parseFloat(cs.strokeWidth || "0");

      el.dataset.stroke = stroke;
      el.dataset.groupKey = domPathKey(el.closest("g") ?? el);
      el.dataset.origSw = cs.strokeWidth || "";

      // default: NOTHING clickable -> prevents body outline selection
      (el.style as any).pointerEvents = "none";

      const fillTransparent =
        fill === "none" || fill === "transparent" || fill === "rgba(0,0,0,0)";

      const hasStroke =
        stroke && stroke !== "none" && stroke !== "rgba(0,0,0,0)";

      const looksMeridian =
        hasStroke &&
        fillTransparent &&
        !isDarkStroke(stroke) &&
        isFinite(sw) &&
        sw > 0 &&
        sw <= 4; // outlines tend to be thicker; meridians usually not huge

      if (looksMeridian) {
        // Only meridian candidates receive pointer events on stroke
        (el.style as any).pointerEvents = "stroke";
        el.dataset.isMeridian = "1";
      } else {
        el.dataset.isMeridian = "0";
      }

      // Allow circles (acupoint dots) to be clickable too, but they won't be “selected”; they map to line
      if (el.tagName.toLowerCase() === "circle") {
        (el.style as any).pointerEvents = "all";
        el.dataset.isDot = "1";
      } else {
        el.dataset.isDot = "0";
      }

      // reset visual overrides
      el.style.opacity = "";
      el.style.strokeWidth = "";
      el.style.filter = "";
      el.classList.remove("tcm-glow");
    });
  }, [ready]);

  // Apply highlight + render labels
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    if (!activePick) {
      nodes.forEach((el) => {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        el.style.filter = "";
        el.classList.remove("tcm-glow");
      });
      return;
    }

    const activeStroke = norm(activePick.stroke);
    const activeGroup = activePick.groupKey;

    const match = (el: SVGElement) => {
      return (
        el.dataset.isMeridian === "1" &&
        (el.dataset.stroke || "") === activeStroke &&
        (el.dataset.groupKey || "") === activeGroup
      );
    };

    const matched = nodes.filter(match);

    // If groupKey too strict (rare), fallback to stroke-only meridian (still avoids body outline)
    const useStrokeOnly = matched.length === 0;

    nodes.forEach((el) => {
      const ok =
        el.dataset.isMeridian === "1" &&
        (el.dataset.stroke || "") === activeStroke &&
        (useStrokeOnly || (el.dataset.groupKey || "") === activeGroup);

      if (ok) {
        el.style.opacity = "1";
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) el.style.strokeWidth = String(orig + 1);
        el.classList.add("tcm-glow");
      } else {
        el.style.opacity = "0.10";
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // ---- Render acupoint labels on the body ----
    // Pick a representative PATH among matched elements (must be a path with getTotalLength)
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    const rep =
      (matched.find((x) => x.tagName.toLowerCase() === "path") as SVGPathElement | undefined) ||
      (nodes.find((x) => {
        return (
          x.tagName.toLowerCase() === "path" &&
          x.dataset.isMeridian === "1" &&
          (x.dataset.stroke || "") === activeStroke
        );
      }) as SVGPathElement | undefined);

    if (!rep || typeof (rep as any).getTotalLength !== "function") return;

    let total = 0;
    try {
      total = rep.getTotalLength();
    } catch {
      return;
    }
    if (!isFinite(total) || total <= 10) return;

    // show up to 12 labels to avoid clutter
    const show = labels.slice(0, 12);
    const start = total * 0.10;
    const end = total * 0.90;

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
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      // Force visibility even if SVG has hostile CSS
      text.setAttribute(
        "style",
        "display:block!important;visibility:visible!important;opacity:1!important;"
      );
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "3");
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${p.code} ${p.zh}`;
      overlay.appendChild(text);
    });
  }, [activePick, labels, ready]);

  // Click handler:
  // - If click hits a dot(circle), map to “best” meridian path within same groupKey (longest path)
  // - If click hits a meridian candidate, pick it directly
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const hit = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!hit) return;

    // IMPORTANT: body outline has pointer-events:none now, so it shouldn't even reach here.
    const groupKey = (hit.dataset.groupKey || "") || domPathKey(hit.closest("g") ?? hit);

    let picked: SVGElement | null = null;

    if (hit.dataset.isMeridian === "1") {
      picked = hit;
    } else if (hit.tagName.toLowerCase() === "circle") {
      // map dot -> longest meridian path in same groupKey
      const candidates = Array.from(svg.querySelectorAll<SVGPathElement>("path")).filter(
        (p) => p.dataset.isMeridian === "1" && (p.dataset.groupKey || "") === groupKey
      );

      let best: SVGPathElement | null = null;
      let bestLen = -1;
      for (const p of candidates) {
        try {
          const len = p.getTotalLength();
          if (len > bestLen) {
            bestLen = len;
            best = p;
          }
        } catch {}
      }
      picked = best;
    } else {
      // other shapes -> ignore
      return;
    }

    if (!picked) return;

    const stroke = picked.dataset.stroke || norm(window.getComputedStyle(picked).stroke);
    if (!stroke || stroke === "none" || stroke === "rgba(0,0,0,0)") return;

    onPick?.({ stroke, groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        已强制禁用人体轮廓点击；点穴位点会映射到同组经络线；穴位名强制显示（不受 SVG 内置 CSS 影响）。
      </div>

      <div
        ref={hostRef}
        onClick={handleClick}
        style={{
          borderRadius: 10,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      />
    </div>
  );
}



