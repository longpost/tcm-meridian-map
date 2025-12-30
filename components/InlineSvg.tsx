"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  activeGroup: string | null;
  onPickGroup?: (g: string | null) => void;
};

function ensureStyleOnce() {
  const id = "__tcm_svg_pick_style__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-28;} }
.tcm-dim { opacity: 0.10; }
.tcm-active {
  opacity: 1 !important;
  stroke-dasharray: 8 6;
  animation: tcmFlow 1.1s linear infinite;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
}
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activeGroup, onPickGroup }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [raw, setRaw] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(src);
      const t = await r.text();
      if (!cancelled) setRaw(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const onClick = (evt: MouseEvent) => {
      const target = evt.target as Element | null;
      const hit = target?.closest(".m-hit") as SVGElement | null;
      if (!hit) return;
      const g = hit.getAttribute("data-group");
      onPickGroup?.(g || null);
    };

    svg.addEventListener("click", onClick);
    return () => svg.removeEventListener("click", onClick);
  }, [raw, onPickGroup]);

  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const hits = Array.from(svg.querySelectorAll<SVGElement>(".m-hit"));
    hits.forEach((el) => {
      el.classList.remove("tcm-active");
      el.classList.remove("tcm-dim");
    });

    if (!activeGroup) return;

    hits.forEach((el) => el.classList.add("tcm-dim"));
    hits
      .filter((el) => el.getAttribute("data-group") === activeGroup)
      .forEach((el) => {
        el.classList.remove("tcm-dim");
        el.classList.add("tcm-active");
      });
  }, [activeGroup]);

  return (
    <div
      ref={hostRef}
      style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}
    />
  );
}


