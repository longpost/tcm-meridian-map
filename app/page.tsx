"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg, { type ActivePick } from "../components/InlineSvg";
import MeridianPanel from "../components/MeridianPanel";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

type Mode = "twelve" | "extra";
const STORAGE_KEY = "tcm_meridian_binding_v3";

function loadMap(): Record<string, MeridianId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
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

  const [binding, setBinding] = useState<Record<string, MeridianId>>({});
  const [q, setQ] = useState("");

  useEffect(() => setBinding(loadMap()), []);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  const ALL: MeridianId[] = [
    "LU", "LI", "ST", "SP", "HT", "SI", "BL", "KI", "PC", "SJ", "GB", "LR", "REN", "DU",
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
    return MERIDIANS.filter(
      (m) =>
        m.id.toLowerCase().includes(t) ||
        m.zh.toLowerCase().includes(t) ||
        m.en.toLowerCase().includes(t)
    );
  }, [q]);

  const clearBindings = () => {
    setBinding({});
    saveMap({});
    setActivePick(null);
  };

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            用法：先点右侧按钮（比如 GB），再去左图点 GB 那条线一次，就完成绑定。以后点线会自动切按钮/说明。
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setActivePick(null)}>清除高亮</button>
          <button onClick={clearBindings}>清空绑定</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16 }}>
        <InlineSvg
          src={src}
          activePick={activePick}
          labels={activePick ? labels : []}
          onPick={(p) => {
            setActivePick(p);
            const k = pickKey(p);

            // ✅ 已绑定：点左图直接切右侧按钮与说明
            const mid = binding[k];
            if (mid) {
              setSelectedMeridian(mid);
              return;
            }

            // ✅ 未绑定：自动把这条线绑定到“当前选中的按钮经络”
            const next = { ...binding, [k]: selectedMeridian };
            setBinding(next);
            saveMap(next);
            // 绑定后右侧本来就是 selectedMeridian，不需要再改
          }}
        />

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>经络按钮</div>

            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL.map((id) => {
                const active = id === selectedMeridian;
                const hasBind = Boolean(findBoundPick(id));
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedMeridian(id);

                      // 如果已有绑定，按钮一按就高亮对应那条线
                      const bound = findBoundPick(id);
                      if (bound) setActivePick(bound);
                      else setActivePick(null);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      background: active ? "#f2f2f2" : "white",
                      cursor: "pointer",
                      opacity: hasBind ? 1 : 0.75,
                    }}
                    title={hasBind ? "已绑定" : "未绑定：点按钮后去左图点对应经络线一次"}
                  >
                    {id}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              当前：<b>{selectedMeridian}</b>{" "}
              {selectedInfo ? <span style={{ opacity: 0.7 }}>· {selectedInfo.zh}</span> : null}
              <div style={{ marginTop: 6 }}>
                {findBoundPick(selectedMeridian)
                  ? "✅ 已绑定：按钮可直接高亮该经络；点左图也会联动。"
                  : "⚠️ 未绑定：请在左图点该经络线一次完成绑定。"}
              </div>
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
                    if (bound) setActivePick(bound);
                    else setActivePick(null);
                  }}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #eee",
                    background: m.id === selectedMeridian ? "#f2f2f2" : "white",
                    cursor: "pointer",
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
            你现在只看到 LU / ST 的穴位名，多半是 ACUPOINTS 里只填了 LU/ST。其他经络没数据就不会显示文字。
          </div>
        </div>
      </div>
    </main>
  );
}



