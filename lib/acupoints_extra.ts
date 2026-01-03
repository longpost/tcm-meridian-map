// lib/acupoints_extra.ts
// 由 /points-extra 导出的 JSON 粘到这里（一次性固化进仓库）

export type ExtraPoint = {
  pid: string;   // p0, p1...
  x: number;     // viewBox坐标
  y: number;
  zh?: string;   // 中文名
  pinyin?: string;
  en?: string;
  code?: string; // CV4 / GV14 等（可选）
};

export type ExtraPointsData = {
  svg: string;
  viewBox: string;      // "minX minY width height"
  updatedAt: string;    // ISO string
  points: ExtraPoint[];
};

// ✅ 关键：给一个明确的类型，让 points 即使空数组也不是 never[]
export const EXTRA_POINTS: ExtraPointsData = {
  svg: "/assets/12meridians8extra_CVGV.svg",
  // 这里先随便填一个占位，等你从 /points-extra 导出后替换成真实 viewBox
  viewBox: "0 0 100 100",
  updatedAt: "REPLACE_ME",
  points: [],
};

