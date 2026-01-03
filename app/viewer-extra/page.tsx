"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ExtraId = "REN" | "DU";
const EXTRA: ExtraId[] = ["REN", "DU"];

const SVG_SRC = "/assets/12meridians8extra_CVGV.svg";
const STORAGE_KEY = `tcm_mapper_extra::${SVG_SRC}`; // 必须和 mapper-extra 一致

type MapData = Record<ExtraId, string[]>;
function emptyMap(): MapData { return { REN: [], DU: [] }; }
function loadMap(): MapData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMap();
    const parsed = JSON.parse(raw);
    return { ...emptyMap(), ...(parsed || {}) };
  } catch {
    return emptyMap();
  }
}

export default function ViewerExtraRenDu() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const [mapData, setMapData] = useState<MapData>(emptyMap());
  const [selected, setSelected] = useState<ExtraId>("REN");

  const bucket = useMemo(() => mapData[selected] || [], [mapData, selected]);

  // 读 localStorage（mapper-extra 保存的）
  useEffect(() => {
    setMapData(loadMap());
    // 监听同页修改（你开两个tab时有用）
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMapData(loadMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  // inject svg + style + click reverse lookup
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

    const peStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    peStyle.textContent = `
      .tcm-hit { pointer-events: all !important; cursor: pointer !important; }
      .tcm-hit * { pointer-events: all !important; }

      @keyframes tcmFlow { 0%{stroke-dashoffset:0;} 100%{stroke-dashoffset:-26;} }
      .m-dim { opacity: 0.10; }
      .m-active {
        opacity: 1 !important;
        stroke-dasharray: 7 6;
        animation: tcmFlow 1.15s linear infinite;
        filter: drop-shadow(0 0 6px rgba(80,160,255,0.75)) drop-shadow(0 0 14px rgba(80,160,255,0.45));
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `;
    svg.appendChild(peStyle);

    // 删韩文
    try {
      const texts = Array.from(svg.querySelectorAll("text"));
      texts.forEach((t) => {
        const s = (t.textContent || "").trim();
        if (/[가-힣]/.test(s)) t.remove();
      });
    } catch {}

    // 反查点击：我们只靠 data-segkey（由 mapper-extra 生成并写入 svg）
    const onClick = (evt: MouseEvent) => {
      const t = evt.target as any;
      const segKey = t?.getAttribute?.("data-segkey") || "";
      if (!segKey) return;

      // reverse lookup：segKey 属于 REN 还是 DU
      for (const id of EXTRA) {
        if ((mapData[id] || []).includes(segKey)) {
          setSelected(id);
          break;
        }
      }
    };
    svg.addEventListener("click", onClick, true);
    return () => svg.removeEventListener("click", onClick, true);
  }, [raw, mapData]);

  // apply highlight
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const all = Array.from(svg.querySelectorAll<SVGElement>("path,polyline,line")).filter((el) =>
      (el.getAttribute("data-segkey") || "").startsWith("s")
    );

    all.forEach((el) => {
      el.classList.remove("m-active");
      el.classList.remove("m-dim");
    });

    all.forEach((el) => el.classList.add("m-dim"));

    if (!bucket.length) return;

    const set = new Set(bucket);
    all.forEach((el) => {
      const k = el.getAttribute("data-segkey") || "";
      if (!k) return;
      if (set.has(k)) {
        el.classList.remove("m-dim");
        el.classList.add("m-active");
      }
    });
  }, [bucket, selected]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Viewer-Extra（任督）</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            映射来源：<code>/mapper-extra</code> 写入 localStorage（独立一套，不影响12经）
          </div>
        </div>
        <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, maxWidth: 420 }}>
        {EXTRA.map((id) => {
          const on = id === selected;
          return (
            <button
              key={id}
              onClick={() => setSelected(id)}
              style={{
                cursor: "pointer",
                padding: "10px 10px",
                borderRadius: 12,
                border: on ? "2px solid #111" : "1px solid #ddd",
                background: on ? "#111" : "#fafafa",
                color: on ? "#fff" : "#111",
                fontWeight: 900,
              }}
            >
              {id}
            </button>
          );
        })}
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #f2c1c1", background: "#fff6f6" }}>
          SVG 加载失败：<b>{err}</b>
        </div>
      ) : null}

      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, padding: 12, background: "#fff" }}>
        <div ref={hostRef} style={{ border: "1px solid #f3f3f3", borderRadius: 12, overflow: "hidden" }} />
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        当前线段数：<b>{bucket.length}</b>{" "}
        {bucket.length === 0 ? <>（去 <code>/mapper-extra</code> 点几条红线加入映射即可）</> : null}
      </div>
    </main>
  );
}
