"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg from "../components/InlineSvg";
import { MERIDIANS, type MeridianId } from "../lib/meridians";

type Mode = "twelve" | "extra";

const STORAGE_KEY = "tcm_meridian_stroke_map_v1";

function loadMap(): Record<string, MeridianId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, MeridianId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");
  const [activeStroke, setActiveStroke] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");
  const [strokeToMeridian, setStrokeToMeridian] = useState<Record<string, MeridianId>>({});

  // load mapping from localStorage (browser only)
  useEffect(() => {
    setStrokeToMeridian(loadMap());
  }, []);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  const meridianToStroke = useMemo(() => {
    // invert strokeToMeridian
    const inv: Record<string, string> = {};
    Object.entries(strokeToMeridian).forEach(([stroke, mid]) => {
      inv[mid] = stroke;
    });
    return inv as Record<MeridianId, string | undefined>;
  }, [strokeToMeridian]);

  // Split buttons: 12 meridians + 任督
  const ALL_BUTTONS: MeridianId[] = [
    "LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR","REN","DU"
  ];

  // auto switch svg when pick REN/DU
  useEffect(() => {
    if (selectedMeridian === "REN" || selectedMeridian === "DU") {
      setMode("extra");
    } else {
      setMode("twelve");
    }
  }, [selectedMeridian]);

  const filteredMeridians = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MERIDIANS;
    return MERIDIANS.filter((m) => {
      return (
        m.id.toLowerCase().includes(t) ||
        m.zh.toLowerCase().includes(t) ||
        m.en.toLowerCase().includes(t)
      );
    });
  }, [q]);

  const bindActiveStrokeToSelected = () => {
    if (!activeStroke) return;
    const next = { ...strokeToMeridian, [activeStroke]: selectedMeridian };
    setStrokeToMeridian(next);
    saveMap(next);
  };

  const highlightSelectedMeridian = () => {
    const stroke = meridianToStroke[selectedMeridian];
    if (stroke) setActiveStroke(stroke);
  };

  const clearAllBindings = () => {
    setStrokeToMeridian({});
    saveMap({});
  };

  const selectedInfo = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            已隐藏原图文字标注（包括韩文等），右侧使用中文/英文科普说明。
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setActiveStroke(null)}>清除高亮</button>
          <button onClick={clearAllBindings} title="清空你本地保存的颜色绑定">
            清空绑定
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <InlineSvg
          src={src}
          activeStroke={activeStroke}
          onPick={({ stroke }) => {
            if (stroke) setActiveStroke(stroke);
          }}
          onStrokesDetected={(list) => setStrokes(list)}
        />

        <div style={{ display: "grid", gap: 12 }}>
          {/* Meridian quick buttons */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络快捷选择（分开了）</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL_BUTTONS.map((id) => {
                const active = id === selectedMeridian;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedMeridian(id);
                      // if already bound, highlight immediately
                      const stroke = meridianToStroke[id];
                      if (stroke) setActiveStroke(stroke);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: active ? "#f2f2f2" : "white",
                      cursor: "pointer"
                    }}
                    title={id}
                  >
                    {id}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              玩法：先点图上的线条（选中一个颜色）→ 再点下面“绑定到当前经络”。
              绑定一次后，以后点经络按钮就能自动高亮。
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12 }}>
                当前高亮颜色：<code>{activeStroke ?? "（无）"}</code>
              </div>
              <button disabled={!activeStroke} onClick={bindActiveStrokeToSelected}>
                绑定到当前经络
              </button>
              <button onClick={highlightSelectedMeridian} title="如果已绑定就会高亮">
                高亮当前经络
              </button>
            </div>
          </div>

          {/* Details */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>
              {selectedInfo ? `${selectedInfo.id} · ${selectedInfo.zh}` : selectedMeridian}
            </div>
            {selectedInfo && (
              <>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                  {selectedInfo.en}
                </div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>科普简介</div>
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>{selectedInfo.blurb}</div>
              </>
            )}
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              免责声明：科普用途，不构成诊断/治疗建议。
            </div>
          </div>

          {/* Searchable list */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络列表（可搜索）</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜：LU / 肺经 / 任脉 / gallbladder ..."
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
            <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 320, overflow: "auto" }}>
              {filteredMeridians.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeridian(m.id)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #eee",
                    background: m.id === selectedMeridian ? "#f2f2f2" : "white",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {m.id} · {m.zh} <span style={{ opacity: 0.7, fontWeight: 500 }}>({m.en})</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{m.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Debug: detected colors */}
          <div style={{ border: "1px dashed #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>检测到的线条颜色（自动）</div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {strokes.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveStroke(s)}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: activeStroke === s ? "#f2f2f2" : "white",
                    cursor: "pointer"
                  }}
                  title="点这个颜色可直接高亮"
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: s,
                      border: "1px solid rgba(0,0,0,0.2)",
                      display: "inline-block",
                    }}
                  />
                  <code style={{ fontSize: 12 }}>{s}</code>
                </button>
              ))}
              {strokes.length === 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>（加载后会显示）</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

