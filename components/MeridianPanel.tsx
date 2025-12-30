"use client";

import React, { useMemo, useState } from "react";
import InlineSvg, { type ActivePick } from "./InlineSvg";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Lang = "zh" | "en";

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

export default function MeridianPanel({ svgPath }: { svgPath: string }) {
  const [lang, setLang] = useState<Lang>("zh");

  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");
  const [activePick, setActivePick] = useState<ActivePick | null>(null);

  const selectedInfo = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  // 图上要显示的穴位标签：来自你自己的 ACUPOINTS（可双语）
  const labels = useMemo(() => {
    const pts = ACUPOINTS[selectedMeridian] ?? [];
    return pts.map((p) => ({
      code: p.code,
      name: lang === "zh" ? p.zh : (p.en || p.zh),
    }));
  }, [selectedMeridian, lang]);

  const twelveMeridians = useMemo(
    () => MERIDIANS.filter((m) => ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"].includes(m.id)),
    []
  );

  const onPickButton = (id: MeridianId) => {
    setSelectedMeridian(id);
    // 没有“经络-线”硬编码映射时，按钮按下先清高亮，
    // 你也可以保留上一条 pick，让它继续高亮
    // 这里更直白：清掉，等用户点线或后续我们做标注版再做到“按钮必定位”。
    setActivePick(null);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activePick={activePick}
          labels={activePick ? labels : []}
          titles={TITLE_HINTS}
          onPick={(pick, hint) => {
            setActivePick(pick);
            if (hint) setSelectedMeridian(hint as MeridianId);
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          点线会高亮；右侧会自动识别为离标题最近的经络（LU/LI/…）。穴位名来自你的 ACUPOINTS（可中英切换）。
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
            {twelveMeridians.map((m) => {
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
          <div style={{ fontWeight: 900, marginBottom: 6 }}>穴位（数据来自 ACUPOINTS）</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            你现在“图上看不到穴位名”的根因：SVG 里没标准穴位编码。要标准化点击穴位，最终要做“标注版 SVG（data-point=LU1…）”。
          </div>

          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflow: "auto" }}>
            {(ACUPOINTS[selectedMeridian] ?? []).map((p) => (
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

        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setActivePick(null)}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" }}
          >
            清除高亮
          </button>
        </div>
      </div>
    </div>
  );
}


