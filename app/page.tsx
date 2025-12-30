"use client";

import React, { useMemo, useState } from "react";
import MeridianPanel from "../components/MeridianPanel";

type Mode = "twelve" | "extra";

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");

  const svgPath = useMemo(() => {
    return mode === "twelve"
      ? "/assets/12meridians12shichen_clean.svg"
      : "/assets/12meridians8extra_CVGV.svg";
  }, [mode]);

  return (
    <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            点右侧 LU/LI/ST… 会高亮对应经络；点图上的经络线会尝试识别并联动右侧说明（如果 SVG 可识别）。
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("twelve")}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: mode === "twelve" ? "#111" : "#fff",
              color: mode === "twelve" ? "#fff" : "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            12 经
          </button>
          <button
            onClick={() => setMode("extra")}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: mode === "extra" ? "#111" : "#fff",
              color: mode === "extra" ? "#fff" : "#111",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            任督/奇经
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <MeridianPanel svgPath={svgPath} />
      </div>
    </main>
  );
}




