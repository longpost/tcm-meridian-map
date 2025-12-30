"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import InlineSvg, { type ActivePick } from "./InlineSvg";
import { MERIDIANS, MeridianId } from "../lib/meridians";

/**
 * 目标：
 * - 不让最终用户做“绑定/校准”
 * - 点击按钮 LU/LI/ST… -> 高亮对应经络（靠 SVG 标题自动推断）
 * - 点击图上的经络线 -> 反推是哪条经 -> 同步右侧按钮与说明
 * - 禁止点到人体轮廓/穴位点/文字导致乱闪
 * - 穴位文字：这张 SVG 自带的大量编号文字默认隐藏，只在选中经络时显示“靠近该经络线”的部分，并强制缩小字号
 *
 * 现实约束（你必须接受的事实）：
 * - 这张 SVG 并没有把每条经络线直接标成 LU/LI…，所以只能用“标题位置 + 附近线段”做自动归类（启发式）
 * - 这能把交互做稳定，但不能保证 100% 医学标准一致（要完美只能做标注版 SVG）
 */

// SVG 里的经络标题（这张 Commons 文件里有）
const TITLES: Array<{ id: MeridianId; title: string }> = [
  { id: "LU", title: "수태음폐경" },
  { id: "LI", title: "수양명대장경" },
  { id: "ST", title: "족양명위경" },
  { id: "SP", title: "족태음비경" },
  { id: "HT", title: "수소음심경" },
  { id: "SI", title: "수태양소장경" },
  { id: "BL", title: "족태양방광경" },
  { id: "KI", title: "족소음신경" },
  { id: "PC", title: "수궐음심포경" },
  { id: "SJ", title: "수소양삼초경" },
  { id: "GB", title: "족소양담경" },
  { id: "LR", title: "족궐음간경" },
];

function injectCssOnce() {
  const id = "__tcm_meridian_css__";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
/* 只允许经络线可点 */
.tcm-meridian-path { pointer-events: stroke !important; cursor: pointer; }

/* 非选中：淡化 */
.tcm-meridian-path.tcm-dim { opacity: 0.15; }

/* 选中：发光+流动，不硬加粗 */
.tcm-meridian-path.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 7 6;
  animation: tcm-flow 1.15s linear infinite;
}
@keyframes tcm-flow { 0%{ stroke-dashoffset:0; } 100%{ stroke-dashoffset:-26; } }

/* 穴位编号文字：默认隐藏，选中经络时才显示附近的 */
.tcm-point-text { display: none !important; }
.tcm-point-text.tcm-show { display: inline !important; }

/* 强制小字号，避免你说的巨大字 */
.tcm-point-text { font-size: 3.2px !important; }
`;
  document.head.appendChild(style);
}

function getTextContent(el: SVGTextElement) {
  return (el.textContent || "").trim();
}
function centerOfBBox(el: SVGGraphicsElement) {
  const b = el.getBBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** 候选经络线：细、长、无填充、带 stroke */
function pickMeridianCandidates(svg: SVGSVGElement): SVGPathElement[] {
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));
  const out: SVGPathElement[] = [];
  for (const p of paths) {
    const fill = (p.getAttribute("fill") || "").trim().toLowerCase();
    if (fill && fill !== "none" && fill !== "transparent") continue;

    const swRaw =
      p.getAttribute("stroke-width") ||
      (p.getAttribute("style") || "").match(/stroke-width:\s*([^;]+)/i)?.[1] ||
      "";
    const sw = parseFloat(String(swRaw).replace("px", "")) || 0;
    if (sw <= 0 || sw > 1.2) continue;

    const stroke =
      (p.getAttribute("stroke") ||
        (p.getAttribute("style") || "").match(/stroke:\s*([^;]+)/i)?.[1] ||
        "").trim();
    if (!stroke || stroke === "none") continue;

    let len = 0;
    try {
      len = p.getTotalLength();
    } catch {
      len = 0;
    }
    if (len < 120) continue;

    out.push(p);
  }
  return out;
}

/** 把 “数字开头” 的 text 当作穴位/编号文字（默认隐藏） */
function tagPointTexts(svg: SVGSVGElement) {
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
  for (const t of texts) {
    const s = getTextContent(t);
    if (/^\d+/.test(s)) t.classList.add("tcm-point-text");
  }
}

/** 自动把候选经络线打上 data-meridian（启发式：标题附近） */
function autoTagMeridians(svg: SVGSVGElement, candidates: SVGPathElement[]) {
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
  const titleNodes: Partial<Record<MeridianId, SVGTextElement>> = {};

  for (const t of texts) {
    const s = getTextContent(t);
    const hit = TITLES.find((x) => x.title === s);
    if (hit) titleNodes[hit.id] = t;
  }

  for (const { id } of TITLES) {
    const titleEl = titleNodes[id];
    if (!titleEl) continue;

    const tc = centerOfBBox(titleEl as any);

    const ranked = candidates
      .map((p) => {
        const pc = centerOfBBox(p as any);
        return { p, d: dist2(tc, pc) };
      })
      .sort((a, b) => a.d - b.d);

    // 前 N 个作为“这条经”的线段集合（基本够用）
    const selected = ranked.slice(0, 26).map((x) => x.p);
    for (const p of selected) p.setAttribute("data-meridian", id);
  }
}

/** 应用选择：高亮经络线 + 显示附近穴位文字 */
function applySelection(svg: SVGSVGElement, id: MeridianId | null) {
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path.tcm-meridian-path"));
  paths.forEach((p) => {
    p.classList.remove("tcm-active");
    p.classList.remove("tcm-dim");
  });
  paths.forEach((p) => p.classList.add("tcm-dim"));

  // 清穴位文字显示
  const pointTexts = Array.from(svg.querySelectorAll<SVGTextElement>("text.tcm-point-text"));
  pointTexts.forEach((t) => t.classList.remove("tcm-show"));

  if (!id) return;

  const actives = Array.from(svg.querySelectorAll<SVGPathElement>(`path.tcm-meridian-path[data-meridian="${id}"]`));
  actives.forEach((p) => {
    p.classList.remove("tcm-dim");
    p.classList.add("tcm-active");
  });

  // 只显示靠近这些线的穴位文字（避免全屏糊）
  if (actives.length) {
    const centers = actives.slice(0, 30).map((p) => centerOfBBox(p as any));
    for (const t of pointTexts) {
      const tc = centerOfBBox(t as any);
      let best = Infinity;
      for (const c of centers) best = Math.min(best, dist2(tc, c));
      if (best < 320) t.classList.add("tcm-show");
    }
  }
}

/** 从 SVG 点击反查是哪条经 */
function getMeridianFromClickedPath(path: SVGPathElement): MeridianId | null {
  const m = path.getAttribute("data-meridian");
  if (!m) return null;
  return (MERIDIANS as any[]).some((x) => x.id === m) ? (m as MeridianId) : null;
}

export default function MeridianPanel({ svgPath }: Props) {
  const [selected, setSelected] = useState<MeridianId | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => (selected ? MERIDIANS.find((m) => m.id === selected) : null), [selected]);

  useEffect(() => {
    injectCssOnce();
  }, []);

  useEffect(() => {
    let cleanup: null | (() => void) = null;

    const tryInit = () => {
      const svg = hostRef.current?.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return false;

      // 关键：把 SVG 内所有元素禁点，避免点到人体/文字/穴位点
      svg.querySelectorAll<SVGElement>("*").forEach((n) => {
        (n as any).style.pointerEvents = "none";
      });

      const candidates = pickMeridianCandidates(svg);
      candidates.forEach((p) => {
        p.classList.add("tcm-meridian-path");
        (p as any).style.pointerEvents = "stroke"; // 只点线
      });

      tagPointTexts(svg);
      autoTagMeridians(svg, candidates);

      // 点击经络线联动
      const onClick = (evt: MouseEvent) => {
        const target = evt.target as Element | null;
        const path = target?.closest("path.tcm-meridian-path") as SVGPathElement | null;
        if (!path) return;

        const mid = getMeridianFromClickedPath(path);
        setSelected(mid);
        applySelection(svg, mid);
      };
      svg.addEventListener("click", onClick);

      // 初始应用
      applySelection(svg, selected);

      cleanup = () => {
        svg.removeEventListener("click", onClick);
      };
      return true;
    };

    const timer = setInterval(() => {
      if (tryInit()) clearInterval(timer);
    }, 60);

    return () => {
      clearInterval(timer);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgPath]);

  const onPickButton = (id: MeridianId) => {
    setSelected(id);
    const svg = hostRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (svg) applySelection(svg, id);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div
        ref={hostRef}
        style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}
      >
        {/* ✅ 你项目的 InlineSvg 要求 activePick + labels，这里给默认值 */}
        <InlineSvg src={svgPath} activePick={null as any as ActivePick | null} labels={[]} />
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>经络（科普）</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>点按钮或点图上的经络线。</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>12 正经</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MERIDIANS.filter((m) =>
              ["LU", "LI", "ST", "SP", "HT", "SI", "BL", "KI", "PC", "SJ", "GB", "LR"].includes(m.id)
            ).map((m) => {
              const active = selected === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onPickButton(m.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 10,
                    padding: "8px 10px",
                    border: active ? "2px solid #111" : "1px solid #ddd",
                    background: active ? "#111" : "#fafafa",
                    color: active ? "#fff" : "#111",
                    fontWeight: 800,
                  }}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px dashed #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>当前选中</div>
          {current ? (
            <>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                {current.id} · {current.zh} <span style={{ opacity: 0.75, fontWeight: 600 }}>({current.en})</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>{current.blurb}</div>
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                说明：这张 SVG 自带的穴位文字多为编号+韩文，我已默认隐藏，只在选中经络时显示靠近该经络的那部分，并强制缩小字号。
                将来要“点某个穴位弹出标准中文/英文名”，需要做一份你自己的穴位数据表（code/zh/en）并把 SVG 点位标注成 data-point。
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>（未选择）</div>
          )}
        </div>
      </div>
    </div>
  );
}

