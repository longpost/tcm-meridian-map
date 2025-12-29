"use client";

import React, { useEffect, useRef, useState } from "react";

export type ActivePick = {
  stroke: string; // normalized computed stroke
  groupKey: string; // closest <g> id or fallback
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
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

function normColor(c: string) {
  return c.trim().toLowerCase().replace(/\s+/g, "");
}

function getGroupKey(el: Element) {
  const g = el.closest("g");
  const id = g?.getAttribute("id");
  if (id && id.trim()) return `g:${id.trim()}`;
  return "g:__noid__";
}

function ensureGlowStyle() {
  const id = "__tcm_glow_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmGlowPulse {
  0%   { filter: drop-shadow(0 0 0px rgba(0,0,0,0)) drop-shadow(0 0 2px rgba(255,255,255,0.15)); }
  50%  { filter: drop-shadow(0 0 3px rgba(255,255,255,0.35)) drop-shadow(0 0 8px rgba(255,255,255,0.65)); }
  100% { filter: drop-shadow(0 0 0px rgba(0,0,0,0)) drop-shadow(0 0 2px rgba(255,255,255,0.15)); }
}
.tcm-glow { animation: tcmGlowPulse 1.15s ease-in-out infinite; }
`;
  document.head.appendChild(style);
}

function isTransparentFill(fill: string) {
  const f = normColor(fill);
  return f === "none" || f === "rgba(0,0,0,0)" || f === "transparent";
}

// 只把“经络线候选”当可点击：必须 stroke 有值，而且 fill 必须是 none/透明（避免点到人体轮廓）
function isMeridianCandidate(el: SVGElement) {
  const cs = window.getComputedStyle(el);
  const stroke = normColor(cs.stroke);
  const fill = cs.fill;
  const sw = parseFloat(cs.strokeWidth || "0");
  if (!stroke || stroke === "none" || stroke === "rgba(0,0,0,0)") return false;
  if (!isTransparentFill(fill)) return false; // 关键：有填充的（人体轮廓）都排除
  if (!isFinite(sw) || sw <= 0) return false;
  return true;
}

export default function InlineSvg({ src, activePick, labels, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);

  // Load SVG
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

  // Inject once per svgRaw
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));
    if (svgRaw) ensureGlowStyle();
  }, [svgRaw]);

  // Cache computed stroke + original strokeWidth; create overlay group
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    nodes.forEach((el) => {
      const cs = window.getComputedStyle(el);
      el.dataset.stroke = normColor(cs.stroke || "");
      el.dataset.origSw = cs.strokeWidth || "";
      el.classList.remove("tcm-glow");
      el.style.opacity = "";
      el.style.strokeWidth = "";
      el.style.filter = "";
    });

    let overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__acupoint_labels__");
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";
  }, [ready]);

  // Highlight + show acupoint labels
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));
    const overlay = svg.querySelector("#__acupoint_labels__") as SVGGElement | null;
    if (overlay) overlay.innerHTML = "";

    // nothing selected -> restore
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

    const inGroup = (el: Element) => {
      const g = el.closest("g");
      const id = g?.getAttribute("id")?.trim();
      const key = id ? `g:${id}` : "g:__noid__";
      return key === activeGroup;
    };

    // pick matched elements in same group and same stroke, but only meridian candidates
    const matched = nodes.filter((el) => {
      const s = el.dataset.stroke || "";
      return s === activeStroke && inGroup(el) && isMeridianCandidate(el);
    });

    // if empty, fallback to same stroke (still candidate-only)
    const useStrokeOnly = matched.length === 0;

    nodes.forEach((el) => {
      const s = el.dataset.stroke || "";
      const match = isMeridianCandidate(el) && s === activeStroke && (useStrokeOnly || inGroup(el));

      if (match) {
        el.style.opacity = "1";
        // keep original thinness, only +1
        const orig = parseFloat(el.dataset.origSw || "0");
        if (isFinite(orig) && orig > 0) el.style.strokeWidth = String(orig + 1);
        el.classList.add("tcm-glow");
      } else {
        // dim everything else BUT do not let body outline become selectable/highlighted
        el.style.opacity = "0.10";
        el.style.strokeWidth = "";
        el.classList.remove("tcm-glow");
        el.style.filter = "";
      }
    });

    // ---- Draw acupoint labels along a representative path ----
    if (!overlay) return;
    if (!labels || labels.length === 0) return;

    // find a representative path among matched candidates
    const rep =
      (matched.find((el) => el.tagName.toLowerCase() === "path") as SVGPathElement | undefined) ||
      (nodes.find((el) => {
        const s = el.dataset.stroke || "";
        return s === activeStroke && el.tagName.toLowerCase() === "path" && isMeridianCandidate(el);
      }) as SVGPathElement | undefined);

    if (!rep || typeof (rep as any).getTotalLength !== "function") return;

    let total = 0;
    try {
      total = rep.getTotalLength();
    } catch {
      return;
    }
    if (!isFinite(total) || total <= 10) return;

    // Show up to 12 labels to avoid clutter
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
      text.setAttribute(
        "font-family",
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
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

  // click -> if clicked on acupoint dot (circle), auto pick best path in same group
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const target = e.target as Element | null;
    if (!target) return;

    const shape = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!shape) return;

    const groupKey = getGroupKey(shape);

    // If the clicked element is not a meridian candidate (e.g. circle point or outline),
    // try to find the best meridian path within the same group.
    let picked: SVGElement | null = null;

    if (shape.tagName.toLowerCase() === "path" && isMeridianCandidate(shape)) {
      picked = shape;
    } else {
      // Search in the same group: choose the longest path candidate (most likely the meridian line)
      const g = shape.closest("g");
      if (g) {
        const candidates = Array.from(g.querySelectorAll<SVGElement>("path"))
          .filter((el) => isMeridianCandidate(el as SVGElement)) as SVGPathElement[];

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
        if (best) picked = best;
      }
    }

    // If still nothing, do nothing (prevents selecting body outline)
    if (!picked) return;

    const stroke = normColor(window.getComputedStyle(picked).stroke);
    if (!stroke || stroke === "none" || stroke === "rgba(0,0,0,0)") return;

    onPick?.({ stroke, groupKey });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        现在不会点到人体轮廓；点到穴位点会自动选中对应经络线；选中后线上会出现穴位名（最多 12 个，避免太挤）。
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




