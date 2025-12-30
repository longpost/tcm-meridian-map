"use client";

import React, { useMemo, useState } from "react";
import InlineSvg from "./InlineSvg";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Lang = "zh" | "en";

const TWELVE: MeridianId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

// SVG 里经络标题（韩文全名），用于“最近标题归属”
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
  const [selected, setSelected] = useState<MeridianId>("LU");

  const current = useMemo(() => MERIDIANS.find((m) => m.id === selected) ?? null, [selected]);

  // 图上要显示的穴位名称：来自你的 ACUPOINTS（中文/英文）
  const labels = useMemo(() => {
    const pts = ACUPOINTS[selected] ?? [];
    return pts.map((p) => ({
      code: p.code,
      name: lang === "zh" ? p.zh : (p.en || p.zh),
    }));
  }, [selected, lang]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
        <InlineSvg
          src={svgPath}
          activeMeridian={selected}
          labels={labels}
          titles={TITLE_HINTS}
          onPickMeridian={(id) => {
            // 点到某条线，已经映射成 LU/LI/ST...
            if (id && TWELVE.includes(id as MeridianId)) setSelected(id as MeridianId);
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          现在：点按钮 ↔ 点经络线 会互相联动。人体轮廓（黑灰线）不会被点亮。
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
              const active = selected === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m.id)}
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
          {current ? (
            <>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                {current.id} · {lang === "zh" ? current.zh : current.en}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>{current.blurb}</div>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>穴位（来自 ACUPOINTS）</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            图中间那排韩文是 SVG 自带标识；中文穴位名是我们从 ACUPOINTS 生成并叠加显示。
          </div>

          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflow: "auto" }}>
            {(ACUPOINTS[selected] ?? []).slice(0, 80).map((p) => (
              <div key={p.code} style={{ padding: 8, border: "1px solid #eee", borderRadius: 10 }}>
                <div style={{ fontWeight: 800 }}>
                  {p.code} · {lang === "zh" ? p.zh : (p.en || p.zh)}
                </div>
                {lang === "zh" && p.en ? <div style={{ fontSize: 12, opacity: 0.7 }}>{p.en}</div> : null}
              </div>
            ))}
            {(ACUPOINTS[selected] ?? []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                这个经络在 ACUPOINTS 里还没填穴位数据，所以图上也不会显示名字。
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}



