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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Meridian Map (Demo)</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            点击彩色经络线高亮；人体轮廓不可点。右侧按钮联动选中。
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
            12经（clean）
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
        <div>
          1) <code>public/assets/12meridians12shichen_clean.svg</code>
        </div>
        <div>
          2) <code>public/assets/12meridians8extra_CVGV.svg</code>
        </div>
      </div>
    </div>
  );
}
