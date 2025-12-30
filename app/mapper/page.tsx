"use client";

import React from "react";
import MeridianPanel from "../../components/MeridianPanel";

export default function MapperPage() {
  // 你也可以在 mapper 页做两张图的切换
  const svgPath = "/assets/12meridians12shichen.svg";

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mapper（管理员映射）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            进入映射 → 点线段归类到 LU/LI… → 导出 JSON → 粘贴到 lib/meridianMap.ts
          </div>
        </div>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
      </div>

      <div style={{ marginTop: 12 }}>
        <MeridianPanel svgPath={svgPath} />
      </div>
    </main>
  );
}
