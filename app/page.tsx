"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg, { type ActivePick, type MeridianAutoIndex } from "../components/InlineSvg";
import MeridianPanel from "../components/MeridianPanel";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Mode = "twelve" | "extra";

// optional: keep your manual binding as fallback
const STORAGE_KEY = "tcm_meridian_pick_map_v3";
function loadMap(): Record<string, MeridianId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}
function saveMap(map: Record<string, MeridianId>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}
function makeKey(p: ActivePick) {
  return `${p.stroke}|${p.groupKey}`;
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");
  const [activePick, setActivePick] = useState<ActivePick | null>(null);
  const [selectedMeridian, setSelectedMeridian] = useState<MeridianId>("LU");

  const [autoIndex, setAutoIndex] = useState<MeridianAutoIndex>({});
  const [bindMode, setBindMode] = useState(false);

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

  // Labels must follow "selectedMeridian", BUT we only render them when activePick exists.
  // (So you won't see wrong labels when nothing is highlighted.)
  const labels = useMemo(() => {
    const pts = ACUPOINTS[selectedMeridian] ?? [];
    return pts.map((p) => ({ code: p.code, zh: p.zh }));
  }, [selectedMeridian]);

  const clearAllBindings = () => {
    setPickToMeridian({});
    saveMap({});
    setActivePick(null);
    setBindMode(false);
  };

  // Try to infer meridian from a pick:
  // 1) if manual binding exists -> use it
  // 2) else if matches autoIndex -> pick the closest meridian
  const inferMeridianFromPick = (p: ActivePick): MeridianId | null => {
    const k = makeKey(p);
    const bound = pickToMeridian[k];
    if (bound) return bound;

    // match by groupKey first (best), then stroke
    const entries = Object.entries(autoIndex) as [MeridianId, ActivePick][];
    const byGroup = entries.find(([mid, ap]) => ap.groupKey === p.groupKey);
    if (byGroup) return byGroup[0];

    const byStroke = entries.find(([mid, ap]) => ap.stroke === p.stroke);
    if (byStroke) return byStroke[0];

    return null;
  };

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            现在按钮会自动定位 ST/LU/LI…；点线会同步按钮；穴位点不会串组；穴位名会画到线上。
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
          labels={activePick ? labels : []}
          onAutoIndex={(idx) => setAutoIndex(idx)}
          onPick={(p) => {
            setActivePick(p);

            // binding mode: bind this pick to current meridian
            if (bindMode) {
              const k = makeKey(p);
              const next = { ...pickToMeridian, [k]: selectedMeridian };
              setPickToMeridian(next);
              saveMap(next);
              setBindMode(false);
              return;
            }

            // normal click: infer meridian and sync button selection
            const mid = inferMeridianFromPick(p);
            if (mid) setSelectedMeridian(mid);
          }}
        />

        <div style={{ display: "grid", gap: 12 }}>
          {/* Buttons */}
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

                      // First try autoIndex (NO need to bind)
                      const ap = autoIndex[id];
                      if (ap) {
                        setActivePick(ap);
                        setBindMode(false);
                        return;
                      }

                      // fallback: ask user to bind
                      setActivePick(null);
                      setBindMode(true);
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
              {autoIndex[selectedMeridian] ? (
                <>✅ 已自动定位：点按钮直接高亮该经络。</>
              ) : bindMode ? (
                <>⚠️ 这条经络在 SVG 里没被自动识别到：请在左图上点一下对应经络线做一次绑定。</>
              ) : (
                <>提示：点线会同步按钮；若某条没法自动识别，就用一次绑定兜底。</>
              )}
            </div>

            <div style={{ marginTop: 8, fontSize: 12 }}>
              当前选中经络：<b>{selectedMeridian}</b>{" "}
              {selectedInfo ? <span style={{ opacity: 0.7 }}>· {selectedInfo.zh}</span> : null}
            </div>
          </div>

          <MeridianPanel pickedStroke={activePick?.stroke} selectedMeridian={selectedMeridian} />

          {/* Search list */}
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
                    const ap = autoIndex[m.id];
                    if (ap) {
                      setActivePick(ap);
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
            说明：图上穴位名最多显示 12 个（防糊图）。要全显示或 hover 才显示，我再改。
          </div>
        </div>
      </div>
    </main>
  );
}


