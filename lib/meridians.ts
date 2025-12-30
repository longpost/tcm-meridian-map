// lib/meridianMap.ts
export type TwelveId =
  | "LU" | "LI" | "ST" | "SP" | "HT" | "SI"
  | "BL" | "KI" | "PC" | "SJ" | "GB" | "LR";

export type ExtraId =
  | "REN" | "DU" | "CHONG" | "DAI"
  | "YINWEI" | "YANGWEI" | "YINQIAO" | "YANGQIAO";

export type MapShape = {
  twelve: Record<TwelveId, string[]>;
  extra: Record<ExtraId, string[]>;
};

// ✅ 把你在网页“导出映射”里复制出来的 JSON 粘贴到这里覆盖即可
export const MERIDIAN_MAP: MapShape = {
  twelve: {
    LU: [], LI: [], ST: [], SP: [], HT: [], SI: [],
    BL: [], KI: [], PC: [], SJ: [], GB: [], LR: [],
  },
  extra: {
    REN: [], DU: [], CHONG: [], DAI: [],
    YINWEI: [], YANGWEI: [], YINQIAO: [], YANGQIAO: [],
  },
};
