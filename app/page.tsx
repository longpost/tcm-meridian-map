"use client";

import React, { useState } from "react";
import InlineSvg from "../components/InlineSvg";
import MeridianPanel from "../components/MeridianPanel";


type Mode = "twelve" | "extra";

export default function Page() {
  const [mode, setMode] = useState<Mode>("twelve");
  const [pickedStroke, setPickedStroke] = useState<string | undefined>(undefined);

  const src =
    mode === "twelve"
      ? "/assets/12meridians12shichen.svg"
      : "/assets/12meridians8extra_CVGV.svg";

  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>经络互动图（科普）</div>
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            图源为 Wikimedia Commons 的 CC BY-SA 4.0 SVG（仓库内含署名与许可说明）。
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setMode("twelve"); setPickedStroke(undefined); }}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: mode === "twelve" ? "#f2f2f2" : "white", cursor: "pointer" }}
          >
            12 经脉
          </button>
          <button
            onClick={() => { setMode("extra"); setPickedStroke(undefined); }}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: mode === "extra" ? "#f2f2f2" : "white", cursor: "pointer" }}
          >
            任/督（extra）
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
        <InlineSvg
          src={src}
          onPick={(info) => setPickedStroke(info.stroke)}
        />
        <MeridianPanel pickedStroke={pickedStroke} />
      </div>
    </main>
  );
}
