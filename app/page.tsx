"use client";

import React from "react";

export default function Page() {
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Meridian Map</h1>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
        三个页面分开：学习练习（判对错）、科普展示（点经络流动高亮）、管理员映射（维护答案库）。
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <a href="/viewer" style={linkStyle}>① Viewer（点经络 → 流动高亮）</a>
        <a href="/quiz" style={linkStyle}>② Quiz（练习：点对指定经络）</a>
        <a href="/mapper" style={linkStyle}>③ Mapper（管理员：维护/导出映射）</a>
      </div>
    </main>
  );
}

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "#fafafa",
  fontWeight: 900,
  textDecoration: "none",
  color: "#111",
};

