"use client";

import React, { useMemo, useState } from "react";
import { MERIDIANS, type MeridianId } from "../lib/meridians";
import { ACUPOINTS } from "../lib/acupoints";

export default function MeridianPanel({
  pickedStroke,
  selectedMeridian,
}: {
  pickedStroke?: string;
  selectedMeridian: MeridianId;
}) {
  const [aq, setAq] = useState("");

  const mer = useMemo(
    () => MERIDIANS.find((m) => m.id === selectedMeridian) ?? null,
    [selectedMeridian]
  );

  const points = ACUPOINTS[selectedMeridian] ?? [];

  const filtered = useMemo(() => {
    const t = aq.trim();
    if (!t) return points;
    const tl = t.toLowerCase();
    return points.filter((p) => p.code.toLowerCase().includes(tl) || p.zh.includes(t));
  }, [aq, points]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>
        {mer ? `${mer.id} · ${mer.zh}` : selectedMeridian}
      </div>
      {mer && (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
          {mer.en}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
        当前高亮颜色：<code>{pickedStroke ?? "（无）"}</code>
      </div>

      {mer && (
        <>
          <div style={{ marginTop: 10, fontWeight: 800 }}>科普简介</div>
          <div style={{ marginTop: 6, lineHeight: 1.5 }}>{mer.blurb}</div>
        </>
      )}

      <div style={{ marginTop: 12, fontWeight: 900 }}>穴位</div>

      {points.length === 0 ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          这条经络的穴位列表我还没填完（目前已补：LU、LI、任脉、督脉）。你要我下一步一次性把 14 条全补齐，我就直接补到文件里。
        </div>
      ) : (
        <>
          <input
            value={aq}
            onChange={(e) => setAq(e.target.value)}
            placeholder="搜穴位：LU7 / 合谷 / DU20 ..."
            style={{
              marginTop: 8,
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />

          <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {filtered.map((p) => (
              <div
                key={p.code}
                style={{
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 10,
                }}
              >
                <div style={{ fontWeight: 850 }}>
                  {p.code} · {p.zh}
                </div>
                {p.en && (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                    {p.en}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        免责声明：科普用途，不构成诊断/治疗建议。
      </div>
    </div>
  );
}

