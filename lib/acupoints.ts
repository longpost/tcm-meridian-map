import type { MeridianId } from "./meridians";

export type Acupoint = {
  code: string; // 如 LU1
  zh: string;   // 中文名
  en?: string;  // 英文名（可选）
};

export const ACUPOINTS: Partial<Record<MeridianId, Acupoint[]>> = {
  // 肺经（11）
  LU: [
    { code: "LU1", zh: "中府" }, { code: "LU2", zh: "云门" }, { code: "LU3", zh: "天府" },
    { code: "LU4", zh: "侠白" }, { code: "LU5", zh: "尺泽" }, { code: "LU6", zh: "孔最" },
    { code: "LU7", zh: "列缺" }, { code: "LU8", zh: "经渠" }, { code: "LU9", zh: "太渊" },
    { code: "LU10", zh: "鱼际" }, { code: "LU11", zh: "少商" },
  ],

  // 大肠经（20）
  LI: [
    { code: "LI1", zh: "商阳" }, { code: "LI2", zh: "二间" }, { code: "LI3", zh: "三间" },
    { code: "LI4", zh: "合谷" }, { code: "LI5", zh: "阳溪" }, { code: "LI6", zh: "偏历" },
    { code: "LI7", zh: "温溜" }, { code: "LI8", zh: "下廉" }, { code: "LI9", zh: "上廉" },
    { code: "LI10", zh: "手三里" }, { code: "LI11", zh: "曲池" }, { code: "LI12", zh: "肘髎" },
    { code: "LI13", zh: "手五里" }, { code: "LI14", zh: "臂臑" }, { code: "LI15", zh: "肩髃" },
    { code: "LI16", zh: "巨骨" }, { code: "LI17", zh: "天鼎" }, { code: "LI18", zh: "扶突" },
    { code: "LI19", zh: "禾髎" }, { code: "LI20", zh: "迎香" },
  ],

  // 任脉（先给常用段；你要全量我后面一口气补齐到 REN24）
  REN: [
    { code: "REN1", zh: "会阴" }, { code: "REN2", zh: "曲骨" }, { code: "REN3", zh: "中极" },
    { code: "REN4", zh: "关元" }, { code: "REN5", zh: "石门" }, { code: "REN6", zh: "气海" },
    { code: "REN7", zh: "阴交" }, { code: "REN8", zh: "神阙" }, { code: "REN9", zh: "水分" },
    { code: "REN10", zh: "下脘" }, { code: "REN11", zh: "建里" }, { code: "REN12", zh: "中脘" },
    { code: "REN13", zh: "上脘" }, { code: "REN14", zh: "巨阙" }, { code: "REN15", zh: "鸠尾" },
    { code: "REN16", zh: "中庭" }, { code: "REN17", zh: "膻中" }, { code: "REN18", zh: "玉堂" },
    { code: "REN19", zh: "紫宫" }, { code: "REN20", zh: "华盖" }, { code: "REN21", zh: "璇玑" },
    { code: "REN22", zh: "天突" }, { code: "REN23", zh: "廉泉" }, { code: "REN24", zh: "承浆" },
  ],

  // 督脉（同理，先给全量到 DU28，满足你“每个穴位名”）
  DU: [
    { code: "DU1", zh: "长强" }, { code: "DU2", zh: "腰俞" }, { code: "DU3", zh: "阳关" },
    { code: "DU4", zh: "命门" }, { code: "DU5", zh: "悬枢" }, { code: "DU6", zh: "脊中" },
    { code: "DU7", zh: "中枢" }, { code: "DU8", zh: "筋缩" }, { code: "DU9", zh: "至阳" },
    { code: "DU10", zh: "灵台" }, { code: "DU11", zh: "神道" }, { code: "DU12", zh: "身柱" },
    { code: "DU13", zh: "陶道" }, { code: "DU14", zh: "大椎" }, { code: "DU15", zh: "哑门" },
    { code: "DU16", zh: "风府" }, { code: "DU17", zh: "脑户" }, { code: "DU18", zh: "强间" },
    { code: "DU19", zh: "后顶" }, { code: "DU20", zh: "百会" }, { code: "DU21", zh: "前顶" },
    { code: "DU22", zh: "囟会" }, { code: "DU23", zh: "上星" }, { code: "DU24", zh: "神庭" },
    { code: "DU25", zh: "素髎" }, { code: "DU26", zh: "水沟" }, { code: "DU27", zh: "兑端" },
    { code: "DU28", zh: "龈交" },
  ],
};
