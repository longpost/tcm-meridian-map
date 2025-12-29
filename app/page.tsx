"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg, { type ActivePick } from "../components/InlineSvg";
import MeridianPanel from "../components/MeridianPanel";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Mode = "twelve" | "extra";
const STORAGE_KEY = "tcm_meridian_binding_v1";

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

function pickKey(p: ActivePick) {
  return `${p.stroke}|${p.groupKey}`;
}
function parsePickKey(k: string): ActivePick | null {
  const i = k.indexOf("|");
  if (i <= 0) return null;
  return { stroke: k.slice(0, i), groupKey: k.slice(i + 1) };
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");
  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");
  const [activePick, setActivePick] = useState<ActivePick | null>(null);

  const [bindMode, setBindMode] = useState(false);
  const [binding, setBinding] = useState<Record<string, MeridianId>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    setBinding(loadMap());
  }, []);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  const ALL: MeridianId[] = [
    "LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR","REN","DU"
  ];

  useEffect(() => {
    if (selectedMeridian === "REN" || selectedMeridian === "DU") setMode("extra");
    else setMode("twelve");
  }, [selectedMeridian]);

  const selectedInfo = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  const labels = useMemo(() => {
    const pts = ACUPOINTS[selectedMeridian] ?? [];
    return pts.map((p) => ({ code: p.code, zh: p.zh }));
  }, [selectedMeridian]);

  const findBoundPick = (mid: MeridianId): ActivePick | null => {
    for (const [k, v] of Object.entries(binding)) {
      if (v === mid) return parsePickKey(k);
    }
    return null;
  };

  const filteredMeridians = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MERIDIANS;
    return MERIDIANS.filter((m) =>
      m.id.toLowerCase().includes(t) ||
      m.zh.toLowerCase().includes(t) ||
      m.en.toLowerCase().includes(t)
    );
  }, [q]);

  const clearBindings = () => {
    setBinding({});
    saveMap({});
    setActivePick(null);
    setBindMode(false);
  };

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            现在需要“绑定一次”让按钮知道哪条线是 LU/ST 等。绑定后不闪、稳定高亮、图上出穴位名。
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setActivePick(null); setBindMode(false); }}>
            清除高亮
          </button>
          <button onClick={clearBindings}>
            清空绑定
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <InlineSvg
          src={src}
          activePick={activePick}
          labels={activePick ? labels : []}
          onPick={(p) => {
            setActivePick(p);

            const key = pickKey(p);

            // bind mode: save mapping
            if (bindMode) {
              const next = { ...binding, [key]: selectedMeridian };
              setBinding(next);
              saveMap(next);
              setBindMode(false);
              return;
            }

            // normal click: if mapped -> sync button
            const mid = binding[key];
            if (mid) setSelectedMeridian(mid);
          }}
        />

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络按钮</div>

            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL.map((id) => {
                const active = id === selectedMeridian;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedMeridian(id);

                      const bound = findBoundPick(id);
                      if (bound) {
                        setActivePick(bound);
                        setBindMode(false);
                      } else {
                        // no mapping yet -> enter bind mode
                        setActivePick(null);
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
                  >
                    {id}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              {bindMode ? (
                <>⚠️ 绑定模式：请在左图上点一下 <b>{selectedMeridian}</b> 的经络线（点到就会高亮 + 保存）。</>
              ) : (
                <>提示：点图上经络线可高亮；如果已绑定，会自动同步右侧按钮。</>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12 }}>
              当前选中：<b>{selectedMeridian}</b>{" "}
              {selectedInfo ? <span style={{ opacity: 0.7 }}>· {selectedInfo.zh}</span> : null}
            </div>
          </div>

          <MeridianPanel pickedStroke={activePick?.stroke} selectedMeridian={selectedMeridian} />

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络列表（搜索）</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜：肺经 / 胃经 / 任脉..."
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
            <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
              {filteredMeridians.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMeridian(m.id);
                    const bound = findBoundPick(m.id);
                    if (bound) {
                      setActivePick(bound);
                      setBindMode(false);
                    } else {
                      setActivePick(null);
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
                    {m.id} · {m.zh} <span style={{ opacity: 0.7, fontWeight: 500 }}>({m.en})</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{m.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            图上穴位名只在“已高亮经络”时显示（最多 12 个），避免糊图。
          </div>
        </div>
      </div>
    </main>
  );
}


