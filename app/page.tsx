"use client";

import React, { useMemo, useState } from "react";
import MeridianPanel from "../components/MeridianPanel";

type Mode = "twelve" | "extra";

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");

  const svgPath = useMemo(() => {
    return mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";
  }, [mode]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Meridian Map</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            点线段 ↔ 按钮联动；映射模式用于把线段归到 LU/LI…（一次性）。
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("twelve")}
            style={{
              cursor: "pointer",
              padding: "10px 12px",
              borderRadius: 12,
              border: mode === "twelve" ? "2px solid #111" : "1px solid #ddd",
              background: mode === "twelve" ? "#111" : "#fafafa",
              color: mode === "twelve" ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            12经
          </button>

          <button
            onClick={() => setMode("extra")}
            style={{
              cursor: "pointer",
              padding: "10px 12px",
              borderRadius: 12,
              border: mode === "extra" ? "2px solid #111" : "1px solid #ddd",
              background: mode === "extra" ? "#111" : "#fafafa",
              color: mode === "extra" ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            任督 + 奇经
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <MeridianPanel svgPath={svgPath} />
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>文件位置检查</div>
        <div>1) <code>public/assets/12meridians12shichen.svg</code></div>
        <div>2) <code>public/assets/12meridians8extra_CVGV.svg</code></div>
      </div>
    </main>
  );
}
