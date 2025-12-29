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

export default function InlineSvg({
  src,
  activeStroke,
  onPick,
  onStrokesDetected,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [svgText, setSvgText] = useState<string>("");
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ on: boolean; x: number; y: number }>({
    on: false,
    x: 0,
    y: 0,
  });

  // Load SVG
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      const text = await res.text();
      if (!cancelled) setSvgText(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // After SVG injected: hide original labels (Korean/whatever), detect strokes, apply highlight
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    // Hide all text labels inside the SVG (so Korean labels disappear)
    svg.querySelectorAll("text").forEach((t) => {
      (t as SVGTextElement).style.display = "none";
    });

    // Detect unique strokes
    const nodes = Array.from(svg.querySelectorAll<SVGElement>(STROKE_SELECTOR));
    const strokes = Array.from(
      new Set(
        nodes
          .map((el) => (el.getAttribute("stroke") || "").trim())
          .filter(Boolean)
      )
    ).sort();
    onStrokesDetected?.(strokes);

    // Apply highlight / dim others
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
        el.style.opacity = "0.12";
        el.style.strokeWidth = "";
        el.style.filter = "none";
      }
    });
  }, [activeStroke, svgText, onStrokesDetected]);

  // Click to pick stroke
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (!target) return;

    const stroked = target.closest(STROKE_SELECTOR) as SVGElement | null;
    if (!stroked) return;

    const stroke = (stroked.getAttribute("stroke") || "").trim() || undefined;
    if (!stroke) return;

    onPick?.({ stroke });
  };

  // Pan/zoom (simple + stable)
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDrag({ on: true, x: e.clientX, y: e.clientY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.on) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ on: true, x: e.clientX, y: e.clientY });
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onMouseUp = () => setDrag((d) => ({ ...d, on: false }));

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.15).toFixed(2)));
  const zoomReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          鼠标拖拽移动；点线条高亮；缩放查看细节
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={zoomOut}>－</button>
          <button onClick={zoomIn}>＋</button>
          <button onClick={zoomReset}>重置</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        style={{
          overflow: "hidden",
          borderRadius: 10,
          border: "1px solid #eee",
          cursor: drag.on ? "grabbing" : "grab",
          userSelect: "none",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            ref={hostRef}
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: svgText }}
          />
        </div>
      </div>
    </div>
  );
}

