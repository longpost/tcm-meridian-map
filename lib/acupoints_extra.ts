// lib/acupoints_extra.ts
// 把 /points-extra 导出的 JSON 粘到这里（一次性固化进仓库）

export const EXTRA_POINTS = {
  // 下面这个对象结构和编辑器导出的 JSON 一样
  // 你把整个 JSON 替换掉即可
  svg: "/assets/12meridians8extra_CVGV.svg",
  viewBox: "0 0 100 100",
  updatedAt: "REPLACE_ME",
  points: [
    // { pid:"p0", x:123, y:456, zh:"关元", pinyin:"Guānyuán", en:"Guanyuan", code:"CV4" },
  ],
} as const;

export type ExtraPoint = (typeof EXTRA_POINTS.points)[number];
