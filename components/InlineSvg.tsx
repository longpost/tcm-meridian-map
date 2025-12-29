"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string;     // normalized computed stroke
  groupKey: string;   // stable DOM-path key
};

export type MeridianAutoIndex = Record<string, ActivePick>; // key is MeridianId like "ST"

type AcupointLabel = { code: string; zh: string };

type Props = {
  src: string;
  activePick: ActivePick | null;
  labels: AcupointLabel[]; // for current selected meridian (may be empty)
  onPick?: (info: ActivePick) => void;
  onAutoIndex?: (index: MeridianAutoIndex) => void; // NEW: auto-find picks for LU/LI/ST...
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse";
const MERIDIAN_IDS = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR","REN","DU"];

function stripSvgTextLabels(svg: string) {
  // remove built-in text labels to avoid non-Chinese + flicker
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}

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
  return "p:" + parts.reverse().join("/");
}

function ensureGlowStyleOnce() {
  const id = "__tcm_svg_interact_style__";
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

function fillTransparent(fill: string) {
  const f = norm(fill);
  return f === "none" || f === "transparent" || f === "rgba(0,0,0,0)";
}

function hasRealStroke(stroke: string) {
  const s = norm(stroke);
  return s && s !== "none" && s !== "rgba(0,0,0,0)";
}

// Very common: body outline is dark + has fill; meridians: no fill + colored stroke
function looksMeridianLine(el: SVGElement) {
  const cs = window.getComputedStyle(el);
  const stroke = cs.stroke;
  const fill = cs.fill;
  const sw = parseFloat(cs.strokeWidth || "0");
  if (!hasRealStroke(stroke)) return false;
  if (!fillTransparent(fill)) return false; // kills body outline
  if (!isFinite(sw) || sw <= 0) return false;
  return true;
}

function pickRepresentativePathInGroup(svg: SVGSVGElement, groupKey: string): SVGPathElement | null {
  // pick the longest path that "looks like meridian line" under the same groupKey
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"))
    .filter((p) => (p.dataset.groupKey || "") === groupKey)
    .filter((p) => looksMeridianLine(p));

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

// Auto-detect meridian groups by id/class/aria-label containing LU/ST/REN...
function buildAutoIndex(svg: SVGSVGElement): MeridianAutoIndex {
  const idx: MeridianAutoIndex = {};

  const allGroups = Array.from(svg.querySelectorAll<SVGGElement>("g"));

  for (const mid of MERIDIAN_IDS) {
    const midLower = mid.toLowerCase();

    // find first group whose attributes hint this meridian
    const g = allGroups.find((g0) => {
      const id = (g0.getAttribute("id") || "").toLowerCase();
      const cls = (g0.getAttribute("class") || "").toLowerCase();
      const label = (g0.getAttribute("aria-label") || "").toLowerCase();
      const data = (g0.getAttribute("data-name") || "").toLowerCase();
      return (
        id.includes(midLower) ||
        cls.includes(midLower) ||
        label.includes(midLower) ||
        data.includes(midLower)
      );
    });

    if (!g) continue;

    const groupKey = domPathKey(g);
    // representative path for that group
    const best = pickRepresentativePathInGroup(svg, groupKey);
    if (!best) continue;

    const stroke = norm(window.getComputedStyle(best).stroke);
    if (!stroke || stroke === "none" || stroke === "rgba(0,0,0,0)") continue;

    idx[mid] = { stroke, groupKey };
  }

  return idx;
}

export default function InlineSvg({ src, activePick, labels, onPick, onAutoIndex }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState<string>("");
  const [ready, setReady] = useState(false);

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

  // inject svg
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    ensureGlowStyleOnce();

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));

    const svg = host.querySelector("svg");
    if (!svg) return;

    // Force our label texts visible even if SVG has hostile CSS
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
  pointer-events: none !important;
}
`;
  }, [svgRaw]);

  // init datasets + pointer-events (prevents selecting body)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    // overlay group for labels
    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    nodes.forEach((el) => {
      const cs = window.getComputedStyle(el);
      el.dataset.stroke = norm(cs.stroke || "");
      const g = el.closest("g") ?? el;
      el.dataset.groupKey = domPathKey(g);
      el.dataset.origSw = cs.strokeWidth || "";

      // default: unclickable => body outline will NOT be selectable
      (el.style as any).pointerEvents = "none";
      el.dataset.isMeridian = "0";
      el.dataset.isDot = "0";

      // allow only meridian lines + dots to be clickable
      if (looksMeridianLine(el)) {
        (el.style as any).pointerEvents = "stroke";
        el.dataset.isMeridian = "1";
      }

      if (el.tagName.toLowerCase() === "circle") {
        (el.style as any).pointerEvents = "all";
        el.dataset.isDot = "1";
      }

      // reset visuals
      el.style.opacity = "";
      el.style.strokeWidth = "";
      el.style.filter = "";
      el.classList.remove("tcm-glow");
    });

    // build and report auto index for buttons
    const auto = buildAutoIndex(svg);
    onAutoIndex?.(auto);
  }, [ready, onAutoIndex]);

  // apply highlight + labels
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

    const isActiveMeridian = (el: SVGElement) =>
      el.dataset.isMeridian === "1" &&
      (el.dataset.stroke || "") === activeStroke &&
      (el.dataset.groupKey || "") === activeGroup;

    // strict match; if none, fallback to stroke-only but STILL ONLY meridian lines
    const strictMatched = nodes.filter(isActiveMeridian);
    const fallbackStrokeOnly = strictMatched.length === 0;

    nodes.forEach((el) => {
      const isMeridian = el.dataset.isMeridian === "1";
      const isDot = el.dataset.isDot === "1";

      const match =
        isMeridian &&
        (el.dataset.stroke || "") === activeStroke &&
        (fallbackStrokeOnly || (el.dataset.groupKey || "") === activeGroup);

      if (match) {
        el.style.opacity = "1";
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) el.style.strokeWidth = String(orig + 1);
        el.classList.add("tcm-glow");
      } else {
        // hide dots from other groups completely (prevents the “left dots show up” complaint)
        if (isDot && (el.dataset.groupKey || "") !== activeGroup) {
          el.style.opacity = "0";
        } else {
          el.style.opacity = "0.08";
        }
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // labels: draw along representative path in active group
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    const rep = pickRepresentativePathInGroup(svg, activeGroup);
    if (!rep || typeof (rep as any).getTotalLength !== "function") return;

    let total = 0;
    try {
      total = rep.getTotalLength();
    } catch { return; }
    if (!isFinite(total) || total <= 10) return;

    const show = labels.slice(0, 12);
    const start = total * 0.10;
    const end = total * 0.90;

    show.forEach((p, idx) => {
      const t = show.length === 1 ? 0.5 : idx / (show.length - 1);
      const len = start + (end - start) * t;

      let pt: DOMPoint | null = null;
      try {
        pt = rep.getPointAtLength(len);
      } catch { pt = null; }
      if (!pt) return;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(pt.x));
      text.setAttribute("y", String(pt.y));
      // bigger so you actually see it
      text.setAttribute("font-size", "14");
      text.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      // force visibility and paint order
      text.setAttribute(
        "style",
        "display:block!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;"
      );
      text.setAttribute("paint-order", "stroke fill");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "4");
      text.setAttribute("stroke-linejoin", "round");
      text.setAttribute("fill", "black");
      text.textContent = `${p.code} ${p.zh}`;
      overlay.appendChild(text);
    });
  }, [activePick, labels, ready]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const hit = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!hit) return;

    const groupKey = hit.dataset.groupKey || domPathKey(hit.closest("g") ?? hit);

    let picked: SVGElement | null = null;

    if (hit.dataset.isMeridian === "1") {
      picked = hit;
    } else if (hit.tagName.toLowerCase() === "circle") {
      // dot -> map to representative path in its group
      picked = pickRepresentativePathInGroup(svg, groupKey);
    } else {
      // everything else not clickable by design
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
        已修：按钮可自动定位经络；别组穴位点会被隐藏；穴位名强制显示（字号加大）。
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



