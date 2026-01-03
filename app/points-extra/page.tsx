"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SVG_SRC = "/assets/12meridians8extra_CVGV.svg";
const STORAGE_KEY = `tcm_points_extra::${SVG_SRC}`;
const BUILD = "POINTS_EXTRA_EDITOR_BUILD_001";

type PointRec = {
  pid: string;   // p0, p1...
  x: number;     // viewBox坐标
  y: number;
  zh?: string;   // 中文名
  pinyin?: string;
  en?: string;
  code?: string; // CV4 / GV14 之类（可选）
};

type PointsData = {
  svg: string;
  viewBox: string;
  points: PointRec[];
  updatedAt: string;
};

function nowISO() {
  return new Date().toISOString();
}

function loadLocal(): PointsData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLocal(d: PointsData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PointsExtraEditor() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const [data, setData] = useState<PointsData | null>(null);
  const [activePid, setActivePid] = useState<string>("");

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
    return () => {
      cancel = true;
    };
  }, []);

  // inject svg + parse points
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

    // 统一加样式（高亮点、hover）
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      .pt-hit { pointer-events: all !important; cursor: pointer !important; }
      .pt-active { filter: drop-shadow(0 0 8px rgba(255,80,80,0.85)) drop-shadow(0 0 18px rgba(255,80,80,0.55)); }
      .pt-ring { fill: rgba(255,0,0,0.0); stroke: rgba(255,0,0,0.0); }
      .pt-ring.pt-hover { stroke: rgba(255,0,0,0.25); stroke-width: 2; }
    `;
    svg.appendChild(style);

    // 删韩文 text（跟你现在习惯一致）
    try {
      const texts = Array.from(svg.querySelectorAll("text"));
      texts.forEach((t) => {
        const s = (t.textContent || "").trim();
        if (/[가-힣]/.test(s)) t.remove();
      });
    } catch {}

    // 读 viewBox
    const viewBox = svg.getAttribute("viewBox") || "";
    if (!viewBox) {
      // 没viewBox也能做，但坐标换算麻烦；这里先硬报错
      setErr("SVG 缺少 viewBox，无法稳定记录穴位坐标。");
      return;
    }

    // 解析 circle 点（穴位点）
    const circles = Array.from(svg.querySelectorAll<SVGCircleElement>("circle"));
    // 过滤太大的圆（比如装饰圆），只留半径小的
    const pts = circles
      .map((c) => {
        const cx = parseFloat(c.getAttribute("cx") || "NaN");
        const cy = parseFloat(c.getAttribute("cy") || "NaN");
        const r = parseFloat(c.getAttribute("r") || "0");
        return { c, cx, cy, r };
      })
      .filter((x) => isFinite(x.cx) && isFinite(x.cy) && x.r > 0 && x.r <= 6);

    // 给每个点标 pid，并加一个透明的点击圈（更好点）
    pts.forEach((p, i) => {
      const pid = `p${i}`;
      p.c.setAttribute("data-pid", pid);
      p.c.classList.add("pt-hit");

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", String(p.cx));
      ring.setAttribute("cy", String(p.cy));
      ring.setAttribute("r", String(Math.max(10, p.r * 3)));
      ring.setAttribute("class", "pt-ring pt-hit");
      ring.setAttribute("data-pid", pid);
      p.c.parentNode?.appendChild(ring);
    });

    // 点击选中
    const onClick = (evt: MouseEvent) => {
      const t = evt.target as any;
      const pid = t?.getAttribute?.("data-pid") || "";
      if (pid) setActivePid(pid);
    };
    svg.addEventListener("click", onClick, true);

    // hover效果
    const onMove = (evt: MouseEvent) => {
      const t = evt.target as any;
      const pid = t?.getAttribute?.("data-pid") || "";
      const rings = Array.from(svg.querySelectorAll<SVGElement>(".pt-ring"));
      rings.forEach((r) => r.classList.remove("pt-hover"));
      if (pid) {
        const ring = svg.querySelector<SVGElement>(`.pt-ring[data-pid="${pid}"]`);
        ring?.classList.add("pt-hover");
      }
    };
    svg.addEventListener("mousemove", onMove, true);

    // 初始化数据：优先 localStorage（保留你之前填的）
    const local = loadLocal();
    if (local && local.svg === SVG_SRC && local.viewBox === viewBox && Array.isArray(local.points)) {
      // 如果点数量变化，做兼容：以当前点为准，补/截断
      const base: PointRec[] = pts.map((p, i) => ({
        pid: `p${i}`,
        x: p.cx,
        y: p.cy,
      }));
      const mapOld = new Map(local.points.map((x) => [x.pid, x]));
      const merged = base.map((b) => ({ ...b, ...(mapOld.get(b.pid) || {}) }));
      const mergedData: PointsData = { svg: SVG_SRC, viewBox, points: merged, updatedAt: nowISO() };
      setData(mergedData);
      saveLocal(mergedData);
    } else {
      const fresh: PointsData = {
        svg: SVG_SRC,
        viewBox,
        points: pts.map((p, i) => ({
          pid: `p${i}`,
          x: p.cx,
          y: p.cy,
        })),
        updatedAt: nowISO(),
      };
      setData(fresh);
      saveLocal(fresh);
    }

    return () => {
      svg.removeEventListener("click", onClick, true);
      svg.removeEventListener("mousemove", onMove, true);
    };
  }, [raw]);

  // 每次 activePid 改变，高亮对应点
  useEffect(() => {
    const host = hostRef.current;
    const svg = host?.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;

    const all = Array.from(svg.querySelectorAll<SVGElement>("[data-pid]"));
    all.forEach((el) => el.classList.remove("pt-active"));

    if (activePid) {
      const hits = Array.from(svg.querySelectorAll<SVGElement>(`[data-pid="${activePid}"]`));
      hits.forEach((el) => el.classList.add("pt-active"));
    }
  }, [activePid]);

  const active = useMemo(() => data?.points.find((p) => p.pid === activePid) || null, [data, activePid]);

  const updateField = (pid: string, patch: Partial<PointRec>) => {
    setData((prev) => {
      if (!prev) return prev;
      const next: PointsData = {
        ...prev,
        points: prev.points.map((p) => (p.pid === pid ? { ...p, ...patch } : p)),
        updatedAt: nowISO(),
      };
      saveLocal(next);
      return next;
    });
  };

  if (err) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{BUILD}</div>
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #f2c1c1", background: "#fff6f6" }}>
          <b>错误：</b>{err}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{BUILD} — 任督穴位命名编辑器</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            你在右侧填名字，自动保存到 localStorage。最后复制/下载 JSON，粘到代码里。
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/" style={{ fontWeight: 900, textDecoration: "none" }}>← Home</a>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 520px", gap: 12 }}>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div ref={hostRef} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }} />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            点图上的穴位点 → 右侧出现输入框。当前：<code>{activePid || "(none)"}</code>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e5e5", borderRadius: 14, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              onClick={() => {
                if (!data) return;
                const txt = JSON.stringify(data, null, 2);
                navigator.clipboard?.writeText(txt);
                alert("已复制 Points JSON（含坐标+名称）");
              }}
              style={btn}
            >
              复制 JSON
            </button>
            <button
              onClick={() => {
                if (!data) return;
                const txt = JSON.stringify(data, null, 2);
                downloadText("points-ren-du.json", txt);
              }}
              style={btn}
            >
              下载 points-ren-du.json
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
              }}
              style={{ ...btn, border: "1px solid #f2c1c1", background: "#fff6f6" }}
            >
              清空并重建
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            点数量：<b>{data?.points.length || 0}</b> ｜ storage key：<code>{STORAGE_KEY}</code>
          </div>

          {active ? (
            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 10, marginBottom: 12 }}>
              <div style={{ fontWeight: 900 }}>编辑：<code>{active.pid}</code></div>
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                <label style={lab}>
                  中文名
                  <input
                    style={inp}
                    value={active.zh || ""}
                    onChange={(e) => updateField(active.pid, { zh: e.target.value })}
                    placeholder="例如：关元"
                  />
                </label>
                <label style={lab}>
                  拼音
                  <input
                    style={inp}
                    value={active.pinyin || ""}
                    onChange={(e) => updateField(active.pid, { pinyin: e.target.value })}
                    placeholder="例如：Guānyuán"
                  />
                </label>
                <label style={lab}>
                  英文
                  <input
                    style={inp}
                    value={active.en || ""}
                    onChange={(e) => updateField(active.pid, { en: e.target.value })}
                    placeholder="例如：Guanyuan"
                  />
                </label>
                <label style={lab}>
                  编号（可选）
                  <input
                    style={inp}
                    value={active.code || ""}
                    onChange={(e) => updateField(active.pid, { code: e.target.value })}
                    placeholder="例如：CV4 / GV14"
                  />
                </label>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  坐标（viewBox）：x=<code>{active.x.toFixed(2)}</code> y=<code>{active.y.toFixed(2)}</code>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ border: "1px dashed #ddd", borderRadius: 12, padding: 12, opacity: 0.75, marginBottom: 12 }}>
              先点左边一个穴位点。
            </div>
          )}

          <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid #eee", borderRadius: 12 }}>
            {(data?.points || []).map((p) => (
              <div
                key={p.pid}
                onClick={() => setActivePid(p.pid)}
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid #f3f3f3",
                  cursor: "pointer",
                  background: p.pid === activePid ? "#111" : "#fff",
                  color: p.pid === activePid ? "#fff" : "#111",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <code style={{ fontSize: 12 }}>{p.pid}</code>
                  <span style={{ fontSize: 12, opacity: p.pid === activePid ? 0.95 : 0.7 }}>
                    {(p.code || "").trim() ? p.code : ""}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontWeight: 900 }}>
                  {p.zh?.trim() ? p.zh : <span style={{ opacity: 0.5 }}>（未命名）</span>}
                  {p.en?.trim() ? <span style={{ marginLeft: 8, fontWeight: 600, opacity: 0.8 }}>{p.en}</span> : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.5 }}>
            你最后要“回到代码里”：点上面【复制 JSON】→ 粘到 <code>lib/acupoints_extra.ts</code>（我下面给你模板）。
          </div>
        </div>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  cursor: "pointer",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fafafa",
  fontWeight: 900,
};

const lab: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
};

const inp: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
  fontSize: 14,
};
