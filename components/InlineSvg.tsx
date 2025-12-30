"use client";

import React, { useEffect, useRef, useState } from "react";

export type MeridianLabel = { code: string; name: string };

type TitleHint = { id: string; text: string };

type Props = {
  src: string;

  // 当前选中的经络
  activeMeridian: string | null;

  // 选中经络后，要在图上显示的穴位名（来自你自己的 ACUPOINTS）
  labels: MeridianLabel[];

  // SVG 里经络标题（韩文全名）
  titles: TitleHint[];

  // 点线时回调（已经映射为 LU/LI/...）
  onPickMeridian?: (id: string | null) => void;
};

// -------- utils --------
function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "");
}
function isGrayOrBlack(stroke: string) {
  const s = norm(stroke);
  if (!s) return true;
  if (s === "black" || s === "#000" || s === "#000000") return true;
  if (s === "#8c8e91" || s === "#a9b5bf" || s === "#666" || s === "#777" || s === "#888") return true;

  const m = s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!m) return false;
  const r = +m[1], g = +m[2], b = +m[3];
  const maxv = Math.max(r, g, b);
  const minv = Math.min(r, g, b);
  return maxv - minv < 18;
}
function getStroke(el: SVGElement) {
  return (
    (el.getAttribute("stroke") ||
      (el.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] ||
      "").trim()
  );
}
function getStrokeWidth(el: SVGElement) {
  const swRaw =
    el.getAttribute("stroke-width") ||
    (el.getAttribute("style") || "").match(/stroke-width:\s*([^;]+)/i)?.[1] ||
    "";
  return parseFloat(String(swRaw).replace("px", "")) || 0;
}
function centerBBox(el: SVGGraphicsElement) {
  const b = el.getBBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// 经络候选线：细、无填充、够长、有 stroke、且 stroke 不是黑灰
function looksMeridian(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag !== "path" && tag !== "polyline" && tag !== "line") return false;

  const stroke = getStroke(el);
  if (!stroke || stroke === "none") return false;

  // ✅ 关键：黑/灰排除 → 人体轮廓点不到
  if (isGrayOrBlack(stroke)) return false;

  const fill = (el.getAttribute("fill") || "").trim().toLowerCase();
  if (fill && fill !== "none" && fill !== "transparent") return false;

  const sw = getStrokeWidth(el);
  if (sw <= 0 || sw > 1.2) return false;

  try {
    const anyEl = el as any;
    if (typeof anyEl.getTotalLength === "function") {
      const len = anyEl.getTotalLength();
      if (!isFinite(len) || len < 90) return false;
    }
  } catch {
    return false;
  }

  return true;
}

function ensureStyleOnce() {
  const id = "__tcm_inline_svg_style_v2__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
@keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-26;} }
.tcm-dim { opacity: 0.10; }
.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-dasharray: 7 6;
  animation: tcmFlow 1.15s linear infinite;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`;
  document.head.appendChild(style);
}

export default function InlineSvg({ src, activeMeridian, labels, titles, onPickMeridian }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgRaw, setSvgRaw] = useState("");

  // load svg
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(src);
      const text = await res.text();
      if (!cancelled) setSvgRaw(text);
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // mount + build data-meridian mapping
  useEffect(() => {
    ensureStyleOnce();

    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = svgRaw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    // overlay group (for Chinese labels)
    let overlay = svg.querySelector("#__tcm_overlay__") as SVGGElement | null;
    if (!overlay) {
      overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlay.setAttribute("id", "__tcm_overlay__");
      svg.appendChild(overlay);
    } else {
      svg.appendChild(overlay);
    }
    overlay.innerHTML = "";

    // 全禁点，避免人体/文字抢点击
    svg.querySelectorAll<SVGElement>("*").forEach((n) => ((n as any).style.pointerEvents = "none"));

    // 找标题坐标（韩文全名）
    const titleCenters: Array<{ id: string; x: number; y: number }> = [];
    const textNodes = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
    for (const t of textNodes) {
      const s = (t.textContent || "").trim();
      const hit = titles.find((x) => x.text === s);
      if (!hit) continue;
      const c = centerBBox(t as any);
      titleCenters.push({ id: hit.id, x: c.x, y: c.y });
    }

    // 找经络候选线（彩色细线）
    const shapes = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line"));
    const meridianEls: SVGElement[] = [];
    for (const el of shapes) {
      if (!looksMeridian(el)) continue;
      el.classList.add("tcm-meridian");
      (el as any).style.pointerEvents = "stroke";
      meridianEls.push(el);
    }

    // ✅ 核心：把每一条候选线段归属到“最近的经络标题”
    // 这样按钮绑定就不会都落在同一条线上
    if (titleCenters.length) {
      for (const el of meridianEls) {
        const c = centerBBox(el as any);
        let best = Infinity;
        let bestId: string | null = null;
        for (const t of titleCenters) {
          const d = dist2(c, t);
          if (d < best) {
            best = d;
            bestId = t.id;
          }
        }
        // 阈值：太远的不归属（避免误伤别的装饰线）
        if (bestId && best < 6000) {
          el.setAttribute("data-meridian", bestId);
        }
      }
    }

    // 点击：只对已经归属的线生效
    const onClick = (evt: MouseEvent) => {
      const target = evt.target as Element | null;
      const hit = target?.closest(".tcm-meridian") as SVGElement | null;
      if (!hit) return;

      const id = hit.getAttribute("data-meridian");
      onPickMeridian?.(id || null);
    };
    svg.addEventListener("click", onClick);

    return () => svg.removeEventListener("click", onClick);
  }, [svgRaw, titles, onPickMeridian]);

  // apply highlight + draw labels near the meridian title (simple + readable)
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const overlay = svg.querySelector("#__tcm_overlay__") as SVGGElement | null;
    if (!overlay) return;
    overlay.innerHTML = "";

    const all = Array.from(svg.querySelectorAll<SVGElement>(".tcm-meridian"));
    all.forEach((el) => {
      el.classList.remove("tcm-active");
      el.classList.remove("tcm-dim");
    });

    if (!activeMeridian) return;

    // dim others, active selected
    all.forEach((el) => el.classList.add("tcm-dim"));
    const actives = all.filter((el) => el.getAttribute("data-meridian") === activeMeridian);
    actives.forEach((el) => {
      el.classList.remove("tcm-dim");
      el.classList.add("tcm-active");
    });

    // 在图上显示中文穴位名：放在右侧列表附近会挡图，所以直接放在图上靠近经络线群中心
    if (!labels || labels.length === 0 || actives.length === 0) return;

    // 用“选中经络线群”的中心当锚点
    let ax = 0, ay = 0;
    for (const el of actives.slice(0, 25)) {
      const c = centerBBox(el as any);
      ax += c.x; ay += c.y;
    }
    ax /= Math.min(25, actives.length);
    ay /= Math.min(25, actives.length);

    const vb = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    const scale = vb && rect.width ? vb.width / rect.width : 1;
    const fontSize = 11 * scale;
    const strokeW = 3 * scale;

    const show = labels.slice(0, 10);
    for (let i = 0; i < show.length; i++) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(ax));
      t.setAttribute("y", String(ay + (i + 1) * fontSize * 1.2));
      t.setAttribute("font-size", String(fontSize));
      t.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto");
      t.setAttribute("paint-order", "stroke fill");
      t.setAttribute("stroke", "white");
      t.setAttribute("stroke-width", String(strokeW));
      t.setAttribute("stroke-linejoin", "round");
      t.setAttribute("fill", "black");
      t.textContent = `${show[i].code} ${show[i].name}`;
      overlay.appendChild(t);
    }
  }, [activeMeridian, labels]);

  return (
    <div
      ref={hostRef}
      style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}
    />
  );
}


