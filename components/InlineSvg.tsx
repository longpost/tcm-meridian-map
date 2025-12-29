"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;      // normalized computed stroke
  groupKey: string;    // closest <g> id or fallback key
};

type AcupointLabel = { code: string; zh: string };

type Props = {
  src: string;
  activePick: ActivePick | null;
  labels: AcupointLabel[]; // points for selected meridian (may be empty)
  onPick?: (info: ActivePick) => void;
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse";

function stripSvgTextLabels(svg: string) {
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

function normColor(c: string) {
  return c.trim().toLowerCase().replace(/\s+/g, "");
}

function getGroupKey(el: Element) {
  const g = el.closest("g");
  const id = g?.getAttribute("id");
  if (id && id.trim()) return `g:${id.trim()}`;
  // fallback: use tag + index within svg to make it stable enough per load
  return "g:__noid__";
}

// pulsing glow animation via CSS injected once
function ensureGlowStyle() {
  const id = "__tcm_glow_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmGlowPulse {
  0%   { filter: drop-shadow(0 0 0px rgba(0,0,0,0)) drop-shadow(0 0 2px rgba(255,255,255,0.15)); }
  50%  { filter: drop-shadow(0 0 3px rgba(255,255,255,0.35)) drop-shadow(0 0 7px rgba(255,255,255,0.55)); }
  100% { filter: drop-shadow(0 0 0px rgba(0,0,0,0)) drop-shadow(0 0 2px rgba(255,255,255,0.15)); }
}
.tcm-glow {
  animation: tcmGlowPulse 1.15s ease-in-out infinite;
}
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);

  // Load SVG (string only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      let text = await res.text();
      text = stripSvgTextLabels(text);
      if (!cancelled) setSvgRaw(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Inject SVG DOM once per load
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));

    if (svgRaw) ensureGlowStyle();
  }, [svgRaw]);

  // Cache original style + computed stroke to dataset (one-time per load)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    nodes.forEach((el) => {
      // compute stroke
      const stroke = normColor(window.getComputedStyle(el).stroke);
      if (stroke && stroke !== "none" && stroke !== "rgba(0,0,0,0)") {
        el.dataset.stroke = stroke;
      } else {
        delete el.dataset.stroke;
      }
      // cache original stroke-width (computed)
      const sw = window.getComputedStyle(el).strokeWidth || "";
      el.dataset.origSw = sw;

      // IMPORTANT: do not touch strokeWidth/opacity here -> keep original thinness
      el.classList.remove("tcm-glow");
      el.style.filter = "";
      el.style.opacity = "";
      el.style.strokeWidth = "";
    });

    // also create overlay group container for point labels
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      // put it at end so it's on top
      svg.appendChild(overlay);
    } else {
      overlay.innerHTML = "";
    }
  }, [ready]);

  // Apply highlight + overlay labels
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    // No active -> restore everything
    if (!activePick) {
      nodes.forEach((el) => {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        el.style.filter = "";
        el.classList.remove("tcm-glow");
      });
      return;
    }

    const activeStroke = normColor(activePick.stroke);
    const activeGroup = activePick.groupKey;

    // determine which elements belong to the clicked group
    const isInActiveGroup = (el: Element) => {
      const g = el.closest("g");
      const id = g?.getAttribute("id")?.trim();
      const key = id ? `g:${id}` : "g:__noid__";
      return key === activeGroup;
    };

    // highlight rule: same group + same stroke
    const matched: SVGElement[] = [];
    nodes.forEach((el) => {
      const s = el.dataset.stroke || "";
      const match = s && s === activeStroke && isInActiveGroup(el);
      if (match) matched.push(el);
    });

    // If matched is empty (rare), fallback to stroke only
    const useFallbackStrokeOnly = matched.length === 0;

    nodes.forEach((el) => {
      const s = el.dataset.stroke || "";
      const match = useFallbackStrokeOnly
        ? (s && s === activeStroke)
        : (s && s === activeStroke && isInActiveGroup(el));

      if (match) {
        el.style.opacity = "1";
        // stroke-width = original + 1 (keep thin)
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) {
          el.style.strokeWidth = String(orig + 1);
        } else {
          el.style.strokeWidth = ""; // don't force
        }
        el.classList.add("tcm-glow");
      } else {
        el.style.opacity = "0.10";
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // ---- Overlay acupoint labels along a representative path ----
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    // pick a representative SVGPathElement from matched elements
    const rep =
      (matched.find((el) => el.tagName.toLowerCase() === "path") as SVGPathElement | undefined) ||
      (nodes.find((el) => {
        const s = el.dataset.stroke || "";
        return s === activeStroke && el.tagName.toLowerCase() === "path";
      }) as SVGPathElement | undefined);

    if (!rep || typeof (rep as any).getTotalLength !== "function") return;

    let total = 0;
    try {
      total = rep.getTotalLength();
    } catch {
      return;
    }
    if (!isFinite(total) || total <= 10) return;

    // Put up to 12 labels to avoid clutter
    const maxLabels = 12;
    const show = labels.slice(0, maxLabels);

    // spread them along the middle 80% of the path
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
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "3");
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${p.code} ${p.zh}`;

      overlay.appendChild(text);
    });
  }, [activePick, labels, ready]);

  // Click -> computed stroke + groupKey
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (!target) return;

    const shape = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!shape) return;

    const stroke = normColor(window.getComputedStyle(shape).stroke);
    if (!stroke || stroke === "none" || stroke === "rgba(0,0,0,0)") return;

    const groupKey = getGroupKey(shape);
    onPick?.({ stroke, groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        点线条高亮：发光流动；未选中时保持原始细度。
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




