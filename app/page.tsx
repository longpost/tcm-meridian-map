"use client";

import React, { useMemo, useState } from "react";
import MeridianPanel from "../components/MeridianPanel";

type Mode = "twelve" | "extra";

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");

  const svgPath = useMemo(() => {
    return mode === "twelve"
      ? "/assets/12meridians12shichen_clickable.svg"
      : "/assets/12meridians8extra_CVGV_clickable.svg";
  }, [mode]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>
        Meridian Map (Demo)
      </h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setMode("twelve")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "twelve" ? "#111" : "#fff",
            color: mode === "twelve" ? "#fff" : "#111",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          12经（clickable）
        </button>

        <button
          onClick={() => setMode("extra")}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "extra" ? "#111" : "#fff",
            color: mode === "extra" ? "#fff" : "#111",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          任督 + 奇经（clickable）
        </button>
      </div>

      <MeridianPanel svgPath={svgPath} />
    </main>
  );
}
