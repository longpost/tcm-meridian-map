"use client";

import React, { useEffect, useMemo, useState } from "react";
import InlineSvg from "../../components/InlineSvg";
import { MERIDIAN_MAP, type TwelveId, type MapShape } from "../../lib/meridianMap";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

const SVG_PATH = "/assets/12meridians12shichen.svg";
const STORAGE_KEY = `tcm_meridian_map::${SVG_PATH}`;

export default function QuizPage() {
  const [map, setMap] = useState<MapShape>(MERIDIAN_MAP);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.twelve && parsed?.extra) setMap(parsed);
      }
    } catch {}
  }, []);

  const [target, setTarget] = useState<TwelveId>(() => pickRandom(TWELVE));
  const [last, setLast] = useState<{ picked: string; correct: boolean } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  // 练习时是否给提示：这里我默认高亮目标经络（你不想提示就改成 []）
  const hintSegKeys = useMemo(() => map.twelve[target] || [], [map, target]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Quiz（练习判对错）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            题目：请在图上点出 <b>{target}</b>。映射来源：mapper 的本地映射（localStorage）。
          </div>
        </div>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setTarget(pickRandom(TWELVE));
            setLast(null);
          }}
          style={btn}
        >
          换一题
        </button>

        <div style={{ fontWeight: 900 }}>
          得分：{score.right}/{score.total}
        </div>

        {last ? (
          <div style={{ fontWeight: 900 }}>
            你点的是：<code>{last.picked}</code> → {last.correct ? "✅ 对" : "❌ 错"}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <InlineSvg
          src={SVG_PATH}
          activeSegKeys={hintSegKeys} // 提示高亮（不想提示就传 []）
          onPickSeg={({ segKey }) => {
            const picked = reverseLookup(map.twelve as any, segKey) || "（未映射）";
            const correct = picked === target;

            setLast({ picked, correct });
            setScore((s) => ({
              right: s.right + (correct ? 1 : 0),
              total: s.total + 1,
            }));
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
        如果你一直看到 “（未映射）”，说明你还没在 <code>/mapper</code> 完成映射（或没保存到本地）。
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  cursor: "pointer",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fafafa",
  fontWeight: 900,
};

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function reverseLookup(map: Record<string, string[]>, segKey: string): string | null {
  for (const [k, arr] of Object.entries(map)) {
    if (arr.includes(segKey)) return k;
  }
  return null;
}
