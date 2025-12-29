"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import InlineSvg from "./InlineSvg";
import { MERIDIANS, MeridianId } from "../lib/meridians";

/**
 * 关键点（就是为了解决你骂的那些问题）：
 * 1) SVG 内部：默认全部 pointer-events: none，彻底禁止点到“人体轮廓/穴位点/文字/背景”
 * 2) 只把“经络线”识别出来并开启 pointer-events，点击只会命中经络线
 * 3) 点击经络线 -> 反查 data-meridian 或 stroke 颜色映射 -> 同步右侧按钮与文案
 * 4) 高亮不再闪：用 class 控制，非选中降透明，选中发光 + 流动
 * 5) 穴位名称：只在“SVG 里可识别到点名”时显示（不会再冒出几处巨大字体乱飞）
 */

/**
 * 如果你的 SVG 已经被“标注版”处理过（推荐的最终方案）：
 * - 经络线：data-meridian="LU" / "LI"...
 * - 穴位文字：data-point="LU1" data-point-zh="中府" data-point-en="Zhongfu"
 * 那么下面这套会直接完整工作。
 *
 * 如果你现在还是未标注版（你目前的情况）：
 * - 我们会尝试用 stroke 颜色做一个“尽量靠谱”的映射；
 * - 如果颜色也不区分，那就只能做到：点线高亮 + 文案显示“未识别经络”（不会再乱点）。
 */
const STROKE_TO_MERIDIAN: Partial<Record<string, MeridianId>> = {
  // 你可以把这里改成你那张图真实的颜色映射（如果不同）。
  // 目前留空/少量占位：即使映射不全，也不会再出现“点人体/点穴位/闪回去”。
  // "#ffbf00": "ST",
  // "#3ac6dd": "LU",
};

type HoverLabel = {
  x: number;
  y: number;
  text: string;
};

export default function MeridianPanel({
  svgPath,
}: {
  svgPath: string; // 例如 "/assets/12meridians12shichen.svg"
}) {
  const [selected, setSelected] = useState<MeridianId | null>(null);
  const [selectedUnknown, setSelectedUnknown] = useState<string | null>(null);
  const [hoverLabels, setHoverLabels] = useState<HoverLabel[]>([]);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const meridianById = useMemo(() => {
    const m = new Map<MeridianId, (typeof MERIDIANS)[number]>();
    for (const item of MERIDIANS) m.set(item.id, item);
    return m;
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    // 等 InlineSvg 把 SVG 注入后再处理
    const el = hostRef.current.querySelector("svg");
    if (!el) return;

    const svg = el as SVGSVGElement;

    // --- 基础安全处理：先把整个 SVG 变成“不可点击”
    svg.querySelectorAll<SVGElement>("*").forEach((node) => {
      (node as any).style.pointerEvents = "none";
    });

    // --- 识别“经络线”：优先 data-meridian，其次用启发式挑出“长路径 + 非填充”的线
    const allPaths = Array.from(svg.querySelectorAll<SVGPathElement>("path"));

    const meridianPaths: SVGPathElement[] = [];
    for (const p of allPaths) {
      const dm = p.getAttribute("data-meridian");
      if (dm && isMeridianId(dm)) {
        meridianPaths.push(p);
        continue;
      }

      // 启发式：排除填充图形；排除超粗线；排除很短的装饰/小圆点
      const fill = p.getAttribute("fill") || "";
      if (fill && fill !== "none" && fill !== "transparent") continue;

      const swRaw = p.getAttribute("stroke-width") || "";
      const sw = parseFloat(swRaw.replace("px", "")) || 0;
      if (sw >= 1.2) continue; // 人体轮廓/粗线常见 >=1

      // path length：长的更像经络线
      let len = 0;
      try {
        len = p.getTotalLength();
      } catch {
        len = 0;
      }
      if (len < 120) continue;

      // stroke：没有 stroke 的也排掉
      const stroke = (p.getAttribute("stroke") || "").trim();
      if (!stroke || stroke === "none") continue;

      meridianPaths.push(p);
    }

    // 开启经络线可点击
    meridianPaths.forEach((p) => {
      (p as any).style.pointerEvents = "stroke"; // 只响应线本身，避免点到“内部区域”
      p.classList.add("tcm-meridian-path");
    });

    // --- 彻底禁用“穴位点/椭圆/圆”的点击（你说的：点穴位一亮一串）
    svg.querySelectorAll("circle, ellipse").forEach((n) => {
      (n as any).style.pointerEvents = "none";
    });

    // --- 点击事件：只处理经络线
    const onClick = (evt: MouseEvent) => {
      const target = evt.target as Element | null;
      if (!target) return;

      const path = target.closest("path.tcm-meridian-path") as SVGPathElement | null;
      if (!path) return;

      // 1) 优先 data-meridian
      const dm = path.getAttribute("data-meridian");
      if (dm && isMeridianId(dm)) {
        applySelection(svg, dm, meridianPaths);
        setSelected(dm);
        setSelectedUnknown(null);
        setHoverLabels(extractPointLabels(svg, dm));
        return;
      }

      // 2) fallback：用 stroke 颜色
      const stroke = (path.getAttribute("stroke") || "").toLowerCase();
      const mapped = STROKE_TO_MERIDIAN[stroke];
      if (mapped) {
        applySelection(svg, mapped, meridianPaths);
        setSelected(mapped);
        setSelectedUnknown(null);
        setHoverLabels(extractPointLabels(svg, mapped));
        return;
      }

      // 3) 识别失败：也要高亮“这条线”，但右侧说明明确写“未识别”
      applySelection(svg, "UNKNOWN" as any, meridianPaths, path);
      setSelected(null);
      setSelectedUnknown(`未识别（stroke=${stroke || "none"}，id=${path.id || "none"}）`);
      setHoverLabels([]);
    };

    svg.addEventListener("click", onClick);

    // --- 注入一次性的 CSS（发光流动 + 非选中淡化）
    injectCssOnce();

    return () => {
      svg.removeEventListener("click", onClick);
    };
  }, [svgPath]);

  const current = selected ? meridianById.get(selected) : null;

  const onPickButton = (id: MeridianId) => {
    const svg = hostRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const meridianPaths = Array.from(svg.querySelectorAll<SVGPathElement>("path.tcm-meridian-path"));
    applySelection(svg, id, meridianPaths);
    setSelected(id);
    setSelectedUnknown(null);
    setHoverLabels(extractPointLabels(svg, id));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
      <div
        ref={hostRef}
        style={{
          position: "relative",
          border: "1px solid #e5e5e5",
          borderRadius: 14,
          padding: 12,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <InlineSvg src={svgPath} className="tcm-svg-host" />

        {/* 穴位标签层：只在可识别时显示；防止被 SVG 盖住 */}
        {hoverLabels.map((h, idx) => (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: h.x,
              top: h.y,
              transform: "translate(-50%, -120%)",
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              padding: "3px 6px",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.2,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {h.text}
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>科普说明</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          本页面仅用于科普学习，不构成诊断或治疗建议。
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>选择经络</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MERIDIANS.map((m) => {
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
                说明：如果你的 SVG 没有标注穴位点（data-point / data-point-zh），图上不会凭空显示穴位名。
                要实现“点线就显示所有穴位中文名”，必须先把 SVG 标注成机器可读。
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                {selectedUnknown ? (
                  <>
                    <div style={{ fontWeight: 900, color: "#b00020" }}>点到了线，但无法识别是哪条经</div>
                    <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                      {selectedUnknown}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                      结论很直接：当前 SVG 没有把经络线做成 LU/LI/ST…可识别结构。要彻底解决，得换“可分层”的图，或把这张图标注一遍。
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.75 }}>（未选择）</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function isMeridianId(x: string): x is MeridianId {
  return (MERIDIANS as any[]).some((m) => m.id === x);
}

function applySelection(
  svg: SVGSVGElement,
  meridianId: MeridianId | "UNKNOWN",
  meridianPaths: SVGPathElement[],
  unknownPicked?: SVGPathElement
) {
  // 先清理
  meridianPaths.forEach((p) => {
    p.classList.remove("tcm-active");
    p.classList.remove("tcm-dim");
  });

  // 默认全部淡化
  meridianPaths.forEach((p) => p.classList.add("tcm-dim"));

  if (meridianId === "UNKNOWN") {
    if (unknownPicked) {
      unknownPicked.classList.remove("tcm-dim");
      unknownPicked.classList.add("tcm-active");
    }
    return;
  }

  // 标注版：按 data-meridian 精准高亮
  const exact = Array.from(svg.querySelectorAll<SVGPathElement>(`path.tcm-meridian-path[data-meridian="${meridianId}"]`));
  if (exact.length) {
    exact.forEach((p) => {
      p.classList.remove("tcm-dim");
      p.classList.add("tcm-active");
    });
    return;
  }

  // fallback：颜色映射
  const strokeColor = Object.entries(STROKE_TO_MERIDIAN).find(([, v]) => v === meridianId)?.[0];
  if (strokeColor) {
    meridianPaths.forEach((p) => {
      const s = (p.getAttribute("stroke") || "").toLowerCase();
      if (s === strokeColor) {
        p.classList.remove("tcm-dim");
        p.classList.add("tcm-active");
      }
    });
  }
}

/**
 * 穴位标签提取（只支持“标注版 SVG”）：
 * - 元素带 data-point / data-point-zh 或 data-point-en
 * - 用 bbox center 投影到容器坐标
 */
function extractPointLabels(svg: SVGSVGElement, meridianId: MeridianId): HoverLabel[] {
  const points = Array.from(svg.querySelectorAll<SVGElement>(`[data-meridian="${meridianId}"][data-point]`));
  if (!points.length) return [];

  const svgRect = svg.getBoundingClientRect();

  return points
    .slice(0, 40) // 别一次性全屏糊一堆字，最多 40 个（你要全量我也能改）
    .map((node) => {
      const r = node.getBoundingClientRect();
      const cx = (r.left + r.right) / 2 - svgRect.left;
      const cy = (r.top + r.bottom) / 2 - svgRect.top;

      const zh = node.getAttribute("data-point-zh");
      const en = node.getAttribute("data-point-en");
      const code = node.getAttribute("data-point") || "";
      const text = zh ? `${code} ${zh}` : en ? `${code} ${en}` : code;

      return { x: cx, y: cy, text };
    });
}

let injected = false;
function injectCssOnce() {
  if (injected) return;
  injected = true;

  const css = `
/* 非选中：淡化 */
.tcm-meridian-path.tcm-dim { opacity: 0.18; }

/* 选中：发光 + “流动” */
.tcm-meridian-path.tcm-active {
  opacity: 1 !important;
  filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 7 6;
  animation: tcm-flow 1.15s linear infinite;
}

/* 防止你说的“选中后变超粗”：这里不强行加粗，只用光效 */
@keyframes tcm-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -26; }
}
  `.trim();

  const style = document.createElement("style");
  style.setAttribute("data-tcm-css", "1");
  style.textContent = css;
  document.head.appendChild(style);
}


