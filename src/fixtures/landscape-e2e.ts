/**
 * 端到端自动驾驶技术调研 Mock 数据 — 全 5 个 Tab
 *
 * 特点：2020 年起爆发式增长，Tesla/Waymo/百度领跑，热词偏 ML/RL。
 * Demo ④ 专用（DESIGN.md Section 6.14.5）。
 */

/** 趋势 Tab */
export const LANDSCAPE_TREND = {
  years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  applications: [48,  89,  156, 312, 634, 1243, 1876, 892],
  grants:        [22,  41,   78, 154, 298,  612,  934, 312],
  byCn:          [18,  35,   71, 156, 378,  834, 1245, 589],
  byUs:          [22,  39,   63, 112, 189,  298,  421, 198],
  byEp:          [ 8,  15,   22,  44,  67,   111,  210,  105],
};

/** 主要玩家 Tab */
export const LANDSCAPE_PLAYERS = {
  ranking: [
    { name: "Tesla",     count: 892,  yoy: "+41%", topIpc: "G06N" },
    { name: "Waymo",     count: 743,  yoy: "+18%", topIpc: "G06V" },
    { name: "百度",      count: 621,  yoy: "+35%", topIpc: "G06N" },
    { name: "华为车BU",  count: 489,  yoy: "+52%", topIpc: "G06N" },
    { name: "小鹏",      count: 312,  yoy: "+78%", topIpc: "G06V" },
    { name: "Nvidia",    count: 287,  yoy: "+29%", topIpc: "G06F" },
    { name: "理想",      count: 198,  yoy: "+112%", topIpc: "G06N" },
  ],
  techComposition: {
    Tesla:    { G06N: 52, G06V: 28, B60W: 12, G06F: 8  },
    Waymo:    { G06V: 44, G06N: 31, G01S: 15, B60W: 10 },
    百度:     { G06N: 48, G06V: 33, G06F: 12, B60W: 7  },
    华为车BU: { G06N: 41, G06V: 35, B60W: 16, G01S: 8  },
  },
};

/** 技术热词 Tab */
export const LANDSCAPE_HOTWORDS = {
  wordCloud: [
    { word: "端到端学习",   weight: 98 },
    { word: "Transformer",  weight: 89 },
    { word: "模仿学习",     weight: 82 },
    { word: "强化学习",     weight: 79 },
    { word: "闭环仿真",     weight: 74 },
    { word: "数据驱动",     weight: 71 },
    { word: "世界模型",     weight: 65 },
    { word: "规划网络",     weight: 61 },
    { word: "隐式表示",     weight: 55 },
    { word: "感知融合",     weight: 51 },
    { word: "BEV特征",      weight: 48 },
    { word: "运动预测",     weight: 44 },
  ],
};

/** 技术现状 Tab */
export const LANDSCAPE_STATUS = {
  legalStatus: { active: 38, expired: 11, pending: 51 },
  byAuthority: { CN: 54, US: 29, EP: 12, WO: 5 },
};

/** 竞争格局 Tab */
export const LANDSCAPE_COMPETITION = {
  hhi: 0.24,
  dominantPlayer: "Tesla",
  competitionLevel: "high" as const,
  whiteSpaces: [
    {
      area: "端到端规划 + 安全验证",
      reason: "现有专利集中在感知端到端，从感知到规划的完整闭环仍稀缺",
    },
    {
      area: "小样本端到端学习",
      reason: "现有方案依赖海量数据，小样本/零样本场景专利覆盖率 < 10%",
    },
  ],
  barriers: [
    {
      area: "端到端感知架构",
      reason: "Tesla/Waymo 专利墙密布，HHI 0.31，新进入者需差异化",
    },
    {
      area: "闭环仿真系统",
      reason: "Waymo/Nvidia 近 3 年活跃授权量占比 > 45%，壁垒极高",
    },
  ],
};
