"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  onPick?: (info: { stroke?: string }) => void;
};

const STROKE_SELECTOR =
  "path[stroke], polyline[stroke], line[stroke], circle[stroke], rect[stroke], ellipse[stroke]";

export default function InlineSvg({ src, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string>("");
  const [activeStroke, setActiveStroke] = useState<string | null>(null);

  useEffect(() => {
    fetch(src)
      .then((res) => res.text())
      .then((text) => setSvgText(text));
  }, [src]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const svg = host.querySelector("svg");
    if (!svg) return;

    const nodes = svg.querySelectorAll<SVGElement>(STROKE_SELECTOR);

    nodes.forEach((el) => {
      const stroke = el.getAttribute("stroke") || "";

      if (!activeStroke) {
        el.style.opacity = "";
        el.style.strokeWidth = "";
        return;
      }

      if (stroke.toLowerCase() === activeStroke.toLowerCase()) {
        el.style.opacity = "1";
        el.style.strokeWidth = "4";
      } else {
        el.style.opacity = "0.12";
        el.style.strokeWidth = "";
      }
    });
  }, [activeStroke, svgText]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (!target) return;

    const stroked = target.closest(STROKE_SELECTOR) as SVGElement | null;
    if (!stroked) return;

    const stroke = stroked.getAttribute("stroke") || undefined;
    if (!stroke) return;

    setActiveStroke(stroke);
    onPick?.({ stroke });
  };

  return (
    <div
      style={{ border: "1px solid #ccc", borderRadius: 8, padding: 8 }}
      ref={hostRef}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: svgText }}
    />
  );
}
