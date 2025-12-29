"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  src: string; // e.g. "/assets/12meridians12shichen.svg"
  onPick?: (info: { stroke?: string; tag: string }) => void;
};

// 只高亮“有 stroke 的图形元素”
const STROKE_SELECTOR = "path[stroke], polyline[stroke], line[stroke], circle[stroke], rect[stroke], ellipse[stroke]";

export default function InlineSvg({ src, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string>("");
  const [activeStroke, setActiveStroke] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      const text = await res.text();
      if (!cancelled) setSvgText(text);
    })();
    return () => { cancelled = true; };
  }, [src]);

  // 每次 activeStroke 变化，直接改 DOM 样式（最稳，不依赖 SVG 内部结构）
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = Array.from(svg.querySelectorAll<SVGElement>(STROKE_SELECTOR));

    for (const el of nodes) {
      const stroke = el.getAttribute("stroke") || "";
      const isHit = activeStroke && stroke && stroke.toLowerCase() === activeStroke.toLowerCase();

      // 没选中：全部正常
      if (!activeStroke) {
        el.style.opacity = "";
        el.style.filter = "";
        el.style.strokeWidth = "";
        continue;
      }

      // 选中：同色高亮，其它变淡
      if (isHit) {
        el.style.opacity = "1";
        el.style.filter = "drop-shadow(0 0 2px rgba(0,0,0,0.35))";
        // 轻微加粗（不改原 stroke-width 属性，只改 style，安全）
        el.style.strokeWidth = "4";
      } else {
        el.style.opacity = "0.12";
        el.style.filter = "none";
        el.style.strokeWidth = "";
      }
    }
  }, [activeStroke, svgText]);

  const clickHandler = useMemo(() => {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      const host = hostRef.current;
      if (!host) return;

      const target = e.target as Element | null;
      if (!target) return;

      // 只处理 SVG 里“有 stroke 的元素”
      const stroked = target.closest(STROKE_SELECTOR) as SVGElement | null;
      if (!stroked) return;

      const stroke = stroked.getAttribute("stroke") || undefined;
      const tag = stroked.tagName.toLowerCase();

      // 点到没有颜色：不处理
      if (!stroke) return;

      setActiveStroke(stroke);
      onPick?.({ stroke, tag });
    };
  }, [onPick]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 8 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          点任意经络线即可高亮（按线条颜色识别）
        </div>
        <button
          onClick={() => setActiveStroke(null)}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
        >
          清除高亮
        </button>
      </div>

      <div
        ref={hostRef}
        onClick={clickHandler}
        // 内联 SVG：必须这么做才能选中 path
        dangerouslySetInnerHTML={{ __html: svgText }}
        style={{ marginTop: 8 }}
      />
    </div>
  );
}
