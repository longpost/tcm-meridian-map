"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  activeStroke: string | null;
  onPick?: (info: { stroke?: string }) => void;
  onStrokesDetected?: (strokes: string[]) => void;
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse";

// 在插入 DOM 前移除所有 <text>，避免任何文字闪烁
function stripSvgTextLabels(svg: string) {
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

// 统一颜色字符串（把 rgb() / #hex 这种尽量转成同一种风格对比）
function normColor(c: string) {
  return c.trim().toLowerCase().replace(/\s+/g, "");
}

export default function InlineSvg({
  src,
  activeStroke,
  onPick,
  onStrokesDetected,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [svgRaw, setSvgRaw] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);

  // 1) 拉取 SVG（只管字符串）
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

  // 2) 把 SVG 字符串注入 DOM（只在 svgRaw 变化时注入一次）
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = svgRaw || "";
    setReady(Boolean(svgRaw));
  }, [svgRaw]);

  // 3) 解析真实 stroke（用 computed style），并应用高亮
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    // 给每个元素写入 data-stroke（computed），以后不用反复算
    const strokesSet = new Set<string>();

    for (const el of nodes) {
      // 注意：computed style 才是“真正画出来的颜色”，继承也能读到
      const stroke = window.getComputedStyle(el).stroke; // e.g. "rgb(0, 0, 0)" or "none"
      const ns = normColor(stroke);
      if (ns && ns !== "none" && ns !== "rgba(0,0,0,0)") {
        el.dataset.stroke = ns;
        strokesSet.add(ns);
      } else {
        delete el.dataset.stroke;
      }

      // 平滑一点，避免你说的那种“闪”
      el.style.transition = "opacity 120ms linear, stroke-width 120ms linear, filter 120ms linear";
    }

    onStrokesDetected?.(Array.from(strokesSet).sort());

    const active = activeStroke ? normColor(activeStroke) : null;

    for (const el of nodes) {
      const s = el.dataset.stroke || null;

      if (!active) {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        el.style.filter = "";
        continue;
      }

      if (s && s === active) {
        el.style.opacity = "1";
        el.style.strokeWidth = "4";
        el.style.filter = "drop-shadow(0 0 2px rgba(0,0,0,0.35))";
      } else {
        el.style.opacity = "0.10";
        el.style.strokeWidth = "";
        el.style.filter = "none";
      }
    }
  }, [activeStroke, ready, onStrokesDetected]);

  // 4) 点击：也用 computed style 拿真实 stroke
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (!target) return;

    const shape = target.closest(SHAPE_SELECTOR) as SVGElement | null;
    if (!shape) return;

    const stroke = window.getComputedStyle(shape).stroke;
    const ns = normColor(stroke);
    if (!ns || ns === "none" || ns === "rgba(0,0,0,0)") return;

    onPick?.({ stroke: ns });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        点线条高亮（现在用真实渲染颜色 computed stroke，继承样式也能高亮）。
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



