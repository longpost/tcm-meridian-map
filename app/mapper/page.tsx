"use client";

import React, { useMemo, useState } from "react";
import MeridianPanel from "../../components/MeridianPanel";

export default function MapperPage() {
  const [mode, setMode] = useState<"twelve" | "extra">("twelve");

  const svgPath = useMemo(() => {
    return mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";
  }, [mode]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mapper（映射管理）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            强制显示 Auto-map/重置；强制开启映射模式（admin）。
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("twelve")}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 10,
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
              padding: "8px 12px",
              borderRadius: 10,
              border: mode === "extra" ? "2px solid #111" : "1px solid #ddd",
              background: mode === "extra" ? "#111" : "#fafafa",
              color: mode === "extra" ? "#fff" : "#111",
              fontWeight: 900,
            }}
          >
            任督+奇经
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <MeridianPanel svgPath={svgPath} defaultAdmin={true} alwaysShowTools={true} />
      </div>
    </div>
  );
}
