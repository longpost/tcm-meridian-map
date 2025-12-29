"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg, { type ActivePick } from "../components/InlineSvg";
import MeridianPanel from "../components/MeridianPanel";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Mode = "twelve" | "extra";
const STORAGE_KEY = "tcm_meridian_pick_map_v2";

// key = `${stroke}|${groupKey}` -> MeridianId
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

function makeKey(p: ActivePick) {
  return `${p.stroke}|${p.groupKey}`;
}

function keyToPick(k: string): ActivePick | null {
  const i = k.indexOf("|");
  if (i <= 0) return null;
  return { stroke: k.slice(0, i), groupKey: k.slice(i + 1) };
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");
  const [activePick, setActivePick] = useState<ActivePick | null>(null);
  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");
  const [bindMode, setBindMode] = useState<boolean>(false);
  const [pickToMeridian, setPickToMeridian] = useState<Record<string, MeridianId>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    setPickToMeridian(loadMap());
  }, []);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  const ALL_BUTTONS: MeridianId[] = [
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

  const filteredMeridians = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MERIDIANS;
    return MERIDIANS.filter((m) =>
      m.id.toLowerCase().includes(t) ||
      m.zh.toLowerCase().includes(t) ||
      m.en.toLowerCase().includes(t)
    );
  }, [q]);

  // Points for overlay labels
  const labels = useMemo(() => {
    const pts = ACUPOINTS[selectedMeridian] ?? [];
    return pts.map((p) => ({ code: p.code, zh: p.zh }));
  }, [selectedMeridian]);

  // Find an existing bound pick for a meridian (first match)
  const findBoundPickForMeridian = (mid: MeridianId): ActivePick | null => {
    for (const [k, v] of Object.entries(pickToMeridian)) {
      if (v === mid) return keyToPick(k);
    }
    return null;
  };

  const clearAllBindings = () => {
    setPickToMeridian({});
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
            规则：按钮优先尝试“已绑定自动高亮”；未绑定则进入绑定模式点线一次完成绑定。
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setActivePick(null); setBindMode(false); }}>
            清除高亮
          </button>
          <button onClick={clearAllBindings}>
            清空绑定
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <InlineSvg
          src={src}
          activePick={activePick}
          // 只有在“真的有高亮线”时才在图上显示穴位名
          labels={activePick ? labels : []}
          onPick={(p) => {
            setActivePick(p);

            const key = makeKey(p);

            // 绑定模式：把这条线绑定到当前经络
            if (bindMode) {
              const next = { ...pickToMeridian, [key]: selectedMeridian };
              setPickToMeridian(next);
              saveMap(next);
              setBindMode(false);
              return;
            }

            // 非绑定模式：若这条线已绑定过，自动切换右侧经络选中
            const mid = pickToMeridian[key];
            if (mid) setSelectedMeridian(mid);
          }}
        />

        <div style={{ display: "grid", gap: 12 }}>
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

                      // 如果已经有绑定，直接高亮那条线（这样穴位名也会出现）
                      const bound = findBoundPickForMeridian(id);
                      if (bound) {
                        setActivePick(bound);
                        setBindMode(false);
                      } else {
                        // 没绑定 -> 进入绑定模式
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
                <>⚠️ 绑定模式：请在左图上点一下 <b>{selectedMeridian}</b> 的经络线（点到就会高亮 + 保存绑定）。</>
              ) : (
                <>提示：点线条会高亮；如果那条线曾绑定过，会自动同步选中 LU/LI 等。</>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12 }}>
              当前选中经络：<b>{selectedMeridian}</b>{" "}
              {selectedInfo ? (
                <span style={{ opacity: 0.7 }}>· {selectedInfo.zh}</span>
              ) : null}
            </div>
          </div>

          <MeridianPanel
            pickedStroke={activePick?.stroke}
            selectedMeridian={selectedMeridian}
          />

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
            <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
              {filteredMeridians.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMeridian(m.id);
                    const bound = findBoundPickForMeridian(m.id);
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
                    {m.id} · {m.zh}{" "}
                    <span style={{ opacity: 0.7, fontWeight: 500 }}>({m.en})</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{m.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            线上穴位名目前最多显示 12 个，防止太挤；你要“全显示/鼠标悬停显示/只显示编号”，我再按你喜好改。
          </div>
        </div>
      </div>
    </main>
  );
}


