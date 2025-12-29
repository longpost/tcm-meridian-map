"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import InlineSvg from "./InlineSvg";
import { MERIDIANS, MeridianId } from "../lib/meridians";

type Props = { svgPath: string };

type MeridianTitle = {
  id: MeridianId;
  // SVG 里出现的标题文本（这张文件里就有）
  title: string;
};

const TITLES: MeridianTitle[] = [
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
/* 全局：默认全部不让点，避免点到人体轮廓/文字/背景 */
.tcm-svg-root * { pointer-events: none !important; }

/* 只有经络线可以点 */
.tcm-meridian-path { pointer-events: stroke !important; cursor: pointer; }

/* 未选中：淡化 */
.tcm-meridian-path.tcm-dim { opacity: 0.15; }

/* 选中：发光+流动（不强行加粗，避免你说的“变粗一坨”） */
.tcm-meridian-path.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 7 6;
  animation: tcm-flow 1.15s linear infinite;
}
@keyframes tcm-flow { 0%{ stroke-dashoffset:0; } 100%{ stroke-dashoffset:-26; } }

/* 穴位文字：默认隐藏，选中经络后才显示“附近的那批” */
.tcm-point-text { display: none !important; }
.tcm-point-text.tcm-show { display: inline !important; }

/* 强制穴位文字不巨大 */
.tcm-point-text { font-size: 3.2px !important; }
`;
  document.head.appendChild(style);
}

function isGrayOrBlack(stroke: string) {
  const s = (stroke || "").trim().toLowerCase();
  return s === "#000" || s === "#000000" || s === "black" || s === "#8c8e91" || s === "#a9b5bf";
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

/**
 * 选“经络线候选”：排除填充图形/粗线/非常短的线
 * 注意：这张 SVG 很多线都是黑的，不能靠颜色判断，所以用几何启发式+靠近标题
 */
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

/**
 * 把“编号/穴名”文字识别出来，做成可控类名
 *（你现在看到的那些巨大/乱闪文本就是它们）
 */
function tagPointTexts(svg: SVGSVGElement) {
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
  for (const t of texts) {
    const s = getTextContent(t);
    // 以数字开头的，基本就是“1회음 / 2곡골 …”这种点名
    if (/^\d+/.test(s)) t.classList.add("tcm-point-text");
  }
}

/**
 * 自动“经络标题 -> 附近经络线”打标签 data-meridian
 */
function autoTagMeridians(svg: SVGSVGElement, candidates: SVGPathElement[]) {
  // 找标题 text
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

    // 从所有候选经络线里选“离标题最近”的一批
    const ranked = candidates
      .map((p) => {
        const pc = centerOfBBox(p as any);
        return { p, d: dist2(tc, pc) };
      })
      .sort((a, b) => a.d - b.d);

    // 取前 N 条作为种子，再扩展：同 stroke 且也很近的都算进来
    const seeds = ranked.slice(0, 18).map((x) => x.p);
    const seedStrokes = new Set(
      seeds.map((p) => (p.getAttribute("stroke") || "").trim().toLowerCase())
    );

    for (const p of candidates) {
      const stroke = (p.getAttribute("stroke") || "").trim().toLowerCase();

      // 如果颜色是明显的经络色（非灰黑）并且属于 seed stroke，就收
      if (seedStrokes.has(stroke) && !isGrayOrBlack(stroke)) {
        p.setAttribute("data-meridian", id);
        continue;
      }

      // 黑线也可能是经络线：用距离标题约束（别全收进来）
      const pc = centerOfBBox(p as any);
      const d = dist2(tc, pc);

      // 这个阈值是按 viewBox（132x224）调过的：只收附近
      if (d < 900 && seedStrokes.has(stroke)) {
        p.setAttribute("data-meridian", id);
      }
    }
  }
}

function applySelection(svg: SVGSVGElement, id: MeridianId | null) {
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path.tcm-meridian-path"));
  paths.forEach((p) => {
    p.classList.remove("tcm-active");
    p.classList.remove("tcm-dim");
  });

  // 默认都淡化
  paths.forEach((p) => p.classList.add("tcm-dim"));

  // 清穴位字
  const pointTexts = Array.from(svg.querySelectorAll<SVGTextElement>("text.tcm-point-text"));
  pointTexts.forEach((t) => t.classList.remove("tcm-show"));

  if (!id) return;

  // 高亮本经的线
  const actives = Array.from(svg.querySelectorAll<SVGPathElement>(`path.tcm-meridian-path[data-meridian="${id}"]`));
  actives.forEach((p) => {
    p.classList.remove("tcm-dim");
    p.classList.add("tcm-active");
  });

  // 显示“靠近这些线”的穴位文字（先别全放出来，避免糊图）
  if (actives.length) {
    const centers = actives.slice(0, 30).map((p) => centerOfBBox(p as any));
    for (const t of pointTexts) {
      const tc = centerOfBBox(t as any);
      // 只要离任一条线中心够近，就显示
      let best = Infinity;
      for (const c of centers) best = Math.min(best, dist2(tc, c));
      if (best < 320) t.classList.add("tcm-show");
    }
  }
}

export default function MeridianPanel({ svgPath }: Props) {
  const [selected, setSelected] = useState<MeridianId | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => (selected ? MERIDIANS.find((m) => m.id === selected) : null), [selected]);

  useEffect(() => {
    injectCssOnce();
  }, []);

  useEffect(() => {
    // 等 InlineSvg 渲染到 DOM
    const tick = () => {
      const svg = hostRef.current?.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return false;

      svg.classList.add("tcm-svg-root");

      // 找经络线候选并标记 class（只这些能点）
      const candidates = pickMeridianCandidates(svg);
      candidates.forEach((p) => p.classList.add("tcm-meridian-path"));

      // 把穴位文字标出来（默认隐藏）
      tagPointTexts(svg);

      // 自动打 data-meridian
      autoTagMeridians(svg, candidates);

      // 点击：读 data-meridian 联动
      const onClick = (evt: MouseEvent) => {
        const target = evt.target as Element | null;
        const path = target?.closest("path.tcm-meridian-path") as SVGPathElement | null;
        if (!path) return;

        const mid = path.getAttribute("data-meridian") as MeridianId | null;
        if (mid) {
          setSelected(mid);
          applySelection(svg, mid);
        } else {
          // 点到了经络线候选，但还没识别出来：不乱跳，只清空
          setSelected(null);
          applySelection(svg, null);
        }
      };
      svg.addEventListener("click", onClick);

      // 初始如果已有选中，重新应用
      applySelection(svg, selected);

      return () => svg.removeEventListener("click", onClick);
    };

    // 小循环等 svg 出现（不依赖你跑命令）
    let cleanup: null | (() => void) = null;
    const timer = setInterval(() => {
      const r = tick();
      if (r && typeof r === "function") {
        cleanup = r;
        clearInterval(timer);
      }
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
      <div ref={hostRef} style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg src={svgPath} />
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>经络（科普）</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>点按钮或点图上的经络线。</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>12 正经</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MERIDIANS.filter((m) => ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"].includes(m.id)).map((m) => {
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
                现在：图上会只显示“靠近该经络线”的穴位文字（SVG 原有文字，已强制缩小，不再巨大乱飞）。
                将来要做中英文切换/点穴位弹出标准名，需要接入你自己的穴位数据表（code/zh/en）。
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

