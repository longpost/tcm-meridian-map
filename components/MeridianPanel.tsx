"use client";

import React, { useMemo, useState } from "react";
import InlineSvg, { type ActivePick } from "./InlineSvg";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Lang = "zh" | "en";

const TWELVE: MeridianId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

// SVG 里那行标题（用它做“无校准绑定”）
const TITLE_HINTS: Array<{ id: MeridianId; text: string }> = [
  { id: "LU", text: "수태음폐경" },
  { id: "LI", text: "수양명대장경" },
  { id: "ST", text: "족양명위경" },
  { id: "SP", text: "족태음비경" },
  { id: "HT", text: "수소음심경" },
  { id: "SI", text: "수태양소장경" },
  { id: "BL", text: "족태양방광경" },
  { id: "KI", text: "족소음신경" },
  { id: "PC", text: "수궐음심포경" },
  { id: "SJ", text: "수소양삼초경" },
  { id: "GB", text: "족소양담경" },
  { id: "LR", text: "족궐음간경" },
];

function dist2(a:{x:number;y:number}, b:{x:number;y:number}) {
  const dx=a.x-b.x, dy=a.y-b.y;
  return dx*dx+dy*dy;
}

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const [lang, setLang] = useState<Lang>("zh");
  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");
  const [activePick, setActivePick] = useState<ActivePick | null>(null);

  // ✅ 自动绑定表：MeridianId -> ActivePick
  const [map, setMap] = useState<Partial<Record<MeridianId, ActivePick>>>({});

  const selectedInfo = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  const labels = useMemo(() => {
    const pts = ACUPOINTS[selectedMeridian] ?? [];
    return pts.map((p) => ({
      code: p.code,
      name: lang === "zh" ? p.zh : (p.en || p.zh),
    }));
  }, [selectedMeridian, lang]);

  const onPickButton = (id: MeridianId) => {
    setSelectedMeridian(id);
    const p = map[id] ?? null;
    setActivePick(p);
  };

  // 反查：pick 属于哪个经（用 map 精确匹配）
  const findByPick = (p: ActivePick): MeridianId | null => {
    for (const id of TWELVE) {
      const mp = map[id];
      if (mp && mp.groupKey === p.groupKey && mp.stroke === p.stroke) return id;
    }
    return null;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activePick={activePick}
          labels={activePick ? labels : []}
          titles={TITLE_HINTS}
          onReady={({ meridianEls, titleCenters, getPickFromEl, getCenterOfEl }) => {
            // ✅ 只做一次绑定（已有 map 就不重复覆盖）
            setMap((prev) => {
              // 如果已经有大部分绑定了，就不动
              const has = TWELVE.filter((id) => prev[id]).length;
              if (has >= 8) return prev;

              const next: Partial<Record<MeridianId, ActivePick>> = { ...prev };

              // 对每条经：找离标题最近的一条彩色经络线
              for (const t of titleCenters) {
                const id = t.id as MeridianId;
                if (!TWELVE.includes(id)) continue;

                let bestEl: SVGElement | null = null;
                let best = Infinity;

                for (const el of meridianEls) {
                  const c = getCenterOfEl(el);
                  const d = dist2(c, t);
                  if (d < best) {
                    best = d;
                    bestEl = el;
                  }
                }

                if (bestEl) next[id] = getPickFromEl(bestEl);
              }

              return next;
            });

            // 如果当前经还没 activePick，用绑定表补一个
            setActivePick((ap) => ap ?? map[selectedMeridian] ?? null);
          }}
          onPick={(pick, hint) => {
            setActivePick(pick);

            // 优先用 hint（最近标题），不靠谱时用 map 精确匹配
            if (hint && TWELVE.includes(hint as MeridianId)) {
              setSelectedMeridian(hint as MeridianId);
              return;
            }

            const m = findByPick(pick);
            if (m) setSelectedMeridian(m);
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          ✅ 只允许彩色经络线可点（人体黑灰轮廓不会再被点亮）。点线会联动右侧按钮；点按钮会让对应经络发光流动。
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>经络（科普）</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setLang("zh")}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: lang === "zh" ? "#111" : "#fff",
                color: lang === "zh" ? "#fff" : "#111",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              中文
            </button>
            <button
              onClick={() => setLang("en")}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: lang === "en" ? "#111" : "#fff",
                color: lang === "en" ? "#fff" : "#111",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              English
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>12 正经</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {MERIDIANS.filter((m) => TWELVE.includes(m.id)).map((m) => {
              const active = selectedMeridian === m.id;
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
                  title={map[m.id] ? "已绑定" : "正在自动绑定…"}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px dashed #eee", paddingTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>当前经络</div>
          {selectedInfo ? (
            <>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                {selectedInfo.id} · {lang === "zh" ? selectedInfo.zh : selectedInfo.en}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>{selectedInfo.blurb}</div>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>穴位（来自 ACUPOINTS）</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            现在图上会沿选中经络显示穴位名（中/英切换），不依赖 SVG 自带韩文。
          </div>

          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflow: "auto" }}>
            {(ACUPOINTS[selectedMeridian] ?? []).slice(0, 60).map((p) => (
              <div key={p.code} style={{ padding: 8, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 800 }}>
                  {p.code} · {lang === "zh" ? p.zh : (p.en || p.zh)}
                </div>
                {lang === "zh" && p.en ? <div style={{ fontSize: 12, opacity: 0.7 }}>{p.en}</div> : null}
              </div>
            ))}
            {(ACUPOINTS[selectedMeridian] ?? []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                这个经络在 ACUPOINTS 里还没填穴位数据，所以图上也不会显示名字。
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            onClick={() => setActivePick(null)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            清除高亮
          </button>
          <button
            onClick={() => {
              // 强制重新绑定一次（给你调试用）
              setMap({});
              setActivePick(null);
            }}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            重新绑定
          </button>
        </div>
      </div>
    </div>
  );
}



