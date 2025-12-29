"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  activeStroke: string | null;
  onPick?: (info: { stroke?: string }) => void;
  onStrokesDetected?: (strokes: string[]) => void;
};

const SHAPE_SELECTOR = "path, polyline, line, circle, rect, ellipse";

// 在插入 DOM 前移除所有 <text>，防止任何文字闪烁
function stripSvgTextLabels(svg: string) {
  return svg.replace(/<text\b[\s\S]*?<\/text>/gi, "");
}

// 从 style 属性中解析 stroke（例如 style="stroke:#00aaff;stroke-width:2"）
function getStrokeFromStyle(styleText: string | null): string | null {
  if (!styleText) return null;
  const m = styleText.match(/stroke\s*:\s*([^;]+)/i);
  if (!m) return null;
  return m[1].trim();
}

// 从元素拿到 stroke：优先 stroke 属性，其次 style 里的 stroke
function getStroke(el: Element): string | null {
  const attr = (el.getAttribute("stroke") || "").trim();
  if (attr) return attr;
  const styleStroke = getStrokeFromStyle(el.getAttribute("style"));
  return styleStroke ? styleStroke : null;
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(SHAPE_SELECTOR));

    // 收集颜色（stroke 可能来自 attribute 或 style）
    const strokes = Array.from(
      new Set(
        nodes
          .map((el) => getStroke(el))
          .filter((s): s is string => Boolean(s))
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).sort();

    onStrokesDetected?.(strokes);

    // 高亮/淡化
    nodes.forEach((el) => {
      const stroke = getStroke(el);

      // 没选中：恢复
      if (!activeStroke) {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        el.style.filter = "";
        return;
      }

      // 选中：同色高亮，否则变淡
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

    // 找到最近的形状元素
    const shape = target.closest(SHAPE_SELECTOR) as Element | null;
    if (!shape) return;

    const stroke = getStroke(shape);
    if (!stroke) return;

    onPick?.({ stroke });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
        点线条高亮；若右侧提示“绑定模式”，点对应经络线一次即可绑定。
      </div>

      <div
        ref={hostRef}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: svgText }}
        style={{
          borderRadius: 10,
          border: "1px solid #eee",
          overflow: "hidden",
        }}
      />
    </div>
  );
}



