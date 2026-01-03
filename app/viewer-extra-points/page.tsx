"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EXTRA_POINTS } from "../../lib/acupoints_extra";

const SVG_SRC = "/assets/12meridians8extra_CVGV.svg";

export default function ViewerExtraPoints() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const [show, setShow] = useState(true);

  // fetch svg
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setErr("");
        const r = await fetch(SVG_SRC, { cache: "no-store" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const t = await r.text();
        if (!t.includes("<svg")) throw new Error("Not SVG (maybe 404 HTML)");
        if (!cancel) setRaw(t);
      } catch (e: any) {
        if (!cancel) setErr(String(e?.message || e));
      }
    })();
    return () => { cancel = true; };
  }, []);

  // inject
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = raw || "";
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";
    svg.style.pointerEvents = "auto";

    // 删韩文
    try {
      const texts = Array.from(svg.querySelectorAll("text"));
      texts.forEach((t) => {
        const s = (t.textContent || "").trim();
        if (/[가-힣]/.test(s)) t.remove();
      });
    } catch {}
  }, [raw]);

  // 计算 overlay 比例（viewBox -> DOM像素）
  const overlay = useMemo(() => {
    const vb = (EXTRA_POINTS.viewBox || "").split(/\s+/).map(Number);
    if (vb.length !== 4 || vb.some((x) => !isFinite(x))) return null;
    const [minX, minY, vbW, vbH] = vb;

    return { minX, minY, vbW, vbH };
  }, []);

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = EXTRA_POINTS.points || [];

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Viewer-Extra（任督穴位名 Overlay）</div>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          显示穴位名
        </label>
        <a href="/points-extra" style={{ fontWeight: 900 }}>去编辑穴位名 →</a>
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #f2c1c1", background: "#fff6f6" }}>
          SVG 加载失败：<b>{err}</b>
        </div>
      ) : null}

      <div
        ref={wrapRef}
        style={{ marginTop: 12, position: "relative", border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}
      >
        <div ref={hostRef} style={{ border: "1px solid #f3f3f3", borderRadius: 12, overflow: "hidden" }} />

        {show && overlay && box ? (
          <div style={{ position: "absolute", left: 12, right: 12, top: 12, bottom: 12, pointerEvents: "none" }}>
            {points
              .filter((p) => (p.zh || "").trim())
              .map((p) => {
                // viewBox 坐标 -> 盒子内像素
                const x = ((p.x - overlay.minX) / overlay.vbW) * box.w;
                const y = ((p.y - overlay.minY) / overlay.vbH) * box.h;
                return (
                  <div
                    key={p.pid}
                    style={{
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: "translate(8px, -50%)",
                      fontSize: 11,
                      fontWeight: 900,
                      background: "rgba(255,255,255,0.85)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 10,
                      padding: "2px 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.code ? `${p.code} ` : ""}{p.zh}
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        提醒：这个页面读的是 <code>lib/acupoints_extra.ts</code>。你如果只填在 localStorage 里还没粘进代码，这里当然不会全显示。
      </div>
    </main>
  );
}
