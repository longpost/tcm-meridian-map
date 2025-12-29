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
  const [bindMode, setBindMode] = useState<boolean>(false); // 关键：按钮点了就进入绑定模式

  useEffect(() => {
    setStrokeToMeridian(loadMap());
  }, []);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  const ALL_BUTTONS: MeridianId[] = [
    "LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR","REN","DU"
  ];

  // 选 REN/DU 自动切换到 extra 图；选其它切回 twelve
  useEffect(() => {
    if (selectedMeridian === "REN" || selectedMeridian === "DU") setMode("extra");
    else setMode("twelve");
  }, [selectedMeridian]);

  const meridianToStroke = useMemo(() => {
    const inv: Record<string, string> = {};
    Object.entries(strokeToMeridian).forEach(([stroke, mid]) => {
      inv[mid] = stroke;
    });
    return inv as Record<MeridianId, string | undefined>;
  }, [strokeToMeridian]);

  const filteredMeridians = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MERIDIANS;
    return MERIDIANS.filter((m) =>
      m.id.toLowerCase().includes(t) ||
      m.zh.toLowerCase().includes(t) ||
      m.en.toLowerCase().includes(t)
    );
  }, [q]);

  const selectedInfo = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  const clearAllBindings = () => {
    setStrokeToMeridian({});
    saveMap({});
    setActiveStroke(null);
    setBindMode(false);
  };

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            已在注入前移除 SVG 的文字标注（韩文不会再闪）。
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setActiveStroke(null); setBindMode(false); }}>
            清除高亮
          </button>
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
            if (!stroke) return;

            // 如果处于绑定模式：点到的线条颜色直接绑定到当前经络，并立刻高亮
            if (bindMode) {
              const next = { ...strokeToMeridian, [stroke]: selectedMeridian };
              setStrokeToMeridian(next);
              saveMap(next);
              setActiveStroke(stroke);
              setBindMode(false);
              return;
            }

            // 非绑定模式：只高亮被点的颜色
            setActiveStroke(stroke);
          }}
          onStrokesDetected={(list) => setStrokes(list)}
        />

        <div style={{ display: "grid", gap: 12 }}>
          {/* Meridian buttons */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络（分开按钮）</div>

            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL_BUTTONS.map((id) => {
                const active = id === selectedMeridian;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedMeridian(id);

                      const stroke = meridianToStroke[id];
                      if (stroke) {
                        // 已绑定：直接高亮，并显示“只看这一条”
                        setActiveStroke(stroke);
                        setBindMode(false);
                      } else {
                        // 未绑定：进入绑定模式，提示用户点图
                        setActiveStroke(null);   // 先不高亮，避免误导
                        setBindMode(true);
                      }
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

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              {meridianToStroke[selectedMeridian] ? (
                <>✅ 已绑定：点按钮会只高亮该经络（其他会变淡）。</>
              ) : bindMode ? (
                <>⚠️ 还没绑定：现在请在左边图上点一下 <b>{selectedMeridian}</b> 的那条线，系统会自动绑定并立刻高亮。</>
              ) : (
                <>提示：如果某经络还没绑定，点它会进入“绑定模式”，然后你点图上的线即可完成绑定。</>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
              当前高亮颜色：<code>{activeStroke ?? "（无）"}</code>
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

          {/* Search */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络列表（可搜索）</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜：肺经 / 任脉 / GB ..."
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
                  onClick={() => {
                    setSelectedMeridian(m.id);
                    const stroke = meridianToStroke[m.id];
                    if (stroke) {
                      setActiveStroke(stroke);
                      setBindMode(false);
                    } else {
                      setActiveStroke(null);
                      setBindMode(true);
                    }
                  }}
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
                    {m.id} · {m.zh}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 500 }}>({m.en})</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{m.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Debug colors */}
          <div style={{ border: "1px dashed #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>检测到的线条颜色</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              这只是调试：你也可以点某个颜色快速高亮。
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {strokes.map((s) => (
                <button
                  key={s}
                  onClick={() => { setActiveStroke(s); setBindMode(false); }}
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

