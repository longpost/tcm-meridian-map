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
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>经络互动图（科普）</h1>
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        本页面仅用于科普学习，不构成医疗建议。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            setMode("twelve");
            setPickedStroke(undefined);
          }}
        >
          12 经脉
        </button>
        <button
          onClick={() => {
            setMode("extra");
            setPickedStroke(undefined);
          }}
        >
          任 / 督
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 16,
        }}
      >
        <InlineSvg
          src={src}
          onPick={(info) => setPickedStroke(info.stroke)}
        />
        <MeridianPanel pickedStroke={pickedStroke} />
      </div>
    </main>
  );
}
