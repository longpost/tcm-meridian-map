"use client";

import React, { useMemo, useState } from "react";
import InlineSvg from "../../components/InlineSvg";
import { MERIDIAN_MAP, type TwelveId } from "../../lib/meridianMap";

const TWELVE: TwelveId[] = ["LU","LI","ST","SP","HT","SI","BL","KI","PC","SJ","GB","LR"];

export default function QuizPage() {
  const svgPath = "/assets/12meridians12shichen_clickable.svg";

  const [target, setTarget] = useState<TwelveId>(() => pickRandom(TWELVE));
  const [last, setLast] = useState<{ picked: string; correct: boolean } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const activeSegKeys = useMemo(() => {
    // 练习时可以不高亮任何，或给一点提示：高亮目标经络
    return MERIDIAN_MAP.twelve[target] || [];
  }, [target]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Quiz（练习判对错）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            题目：请在图上点出 <b>{target}</b> 对应的经络线段。点错会提示正确答案。
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
          src={svgPath}
          activeSegKeys={activeSegKeys} // 给提示就留着，不想提示就改成 []
          onPickSeg={({ segKey }) => {
            const picked = reverseLookup(MERIDIAN_MAP.twelve as any, segKey) || "（未映射）";
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
        注意：如果你点到 “（未映射）”，说明那段线还没被管理员映射进任何经络（去 /mapper 补）。
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
