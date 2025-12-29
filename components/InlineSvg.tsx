"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  activeStroke: string | null;
  onPick?: (info: { stroke?: string }) => void;
  onStrokesDetected?: (strokes: string[]) => void;
};

const STROKE_SELECTOR =
  "path[stroke], polyline[stroke], line[stroke], circle[stroke], rect[stroke], ellipse[stroke]";

// 关键：在插入 DOM 之前，直接从 SVG 字符串里移除所有 <text>...</text>，避免“闪”
function stripSvgTextLabels(svg: string) {
  // 删除 <text ...>...</text>（跨行）
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

export default function InlineSvg({
  src,
  activeStroke,
  onPick,
  onStrokesDetected,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      let text = await res.text();
      text = stripSvgTextLabels(text);
      if (!cancelled) setSvgText(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // 应用高亮/变淡 + 统计颜色
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(STROKE_SELECTOR));

    // 统计 unique strokes
    const strokes = Array.from(
      new Set(
        nodes
          .map((el) => (el.getAttribute("stroke") || "").trim())
          .filter(Boolean)
      )
    ).sort();
    onStrokesDetected?.(strokes);

    // 高亮逻辑
    nodes.forEach((el) => {
      const stroke = (el.getAttribute("stroke") || "").trim();
      if (!activeStroke) {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        el.style.filter = "";
        return;
      }
      if (stroke && stroke.toLowerCase() === activeStroke.toLowerCase()) {
        el.style.opacity = "1";
        el.style.strokeWidth = "4";
        el.style.filter = "drop-shadow(0 0 2px rgba(0,0,0,0.35))";
      } else {
        el.style.opacity = "0.10";
        el.style.strokeWidth = "";
        el.style.filter = "none";
      }
    });
  }, [activeStroke, svgText, onStrokesDetected]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (!target) return;

    const stroked = target.closest(STROKE_SELECTOR) as SVGElement | null;
    if (!stroked) return;

    const stroke = (stroked.getAttribute("stroke") || "").trim() || undefined;
    if (!stroke) return;

    onPick?.({ stroke });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        点线条高亮；如果你刚选了某条经络，点图上的对应线条会自动绑定。
      </div>

      <div
        ref={hostRef}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: svgText }}
        style={{ borderRadius: 10, border: "1px solid #eee", overflow: "hidden" }}
      />
    </div>
  );
}


