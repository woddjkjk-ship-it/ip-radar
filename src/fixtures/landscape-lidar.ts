/**
 * 激光雷达技术调研 Mock 数据 — 全 5 个 Tab
 *
 * 特点：成熟技术 2019 前已有基础、中国企业近年崛起（禾赛/速腾聚创）、
 * 热词偏硬件/点云处理。 Demo ⑤ 专用（DESIGN.md Section 6.14.6）。
 */

/** 趋势 Tab */
export const LANDSCAPE_TREND = {
  years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  applications: [1123, 1456, 1789, 2234, 2891, 3456, 4123, 1876],
  grants:        [ 712,  934, 1123, 1445, 1823, 2134, 2567, 1023],
  byCn:          [ 523,  712,  934, 1234, 1678, 2234, 2789, 1234],
  byUs:          [ 389,  489,  567,  678,  789,  867,  945,  412],
  byEp:          [ 211,  255,  288,  322,  424,  355,  389,  230],
};

/** 主要玩家 Tab */
export const LANDSCAPE_PLAYERS = {
  ranking: [
    { name: "华为",      count: 2134, yoy: "+38%", topIpc: "G01S" },
    { name: "Waymo",     count: 1876, yoy: "+12%", topIpc: "G01S" },
    { name: "禾赛科技",  count: 1234, yoy: "+67%", topIpc: "G01S" },
    { name: "速腾聚创",  count: 1089, yoy: "+54%", topIpc: "G01S" },
    { name: "百度",      count:  934, yoy: "+23%", topIpc: "G01S" },
    { name: "Luminar",   count:  812, yoy: "+31%", topIpc: "G01S" },
    { name: "Velodyne",  count:  743, yoy: "-8%",  topIpc: "G01S" },
  ],
  techComposition: {
    华为:     { G01S: 68, G06V: 18, H01S: 10, G06F: 4  },
    Waymo:    { G01S: 62, G06V: 22, B60W: 11, G06F: 5  },
    禾赛科技: { G01S: 78, H01S: 14, G06V: 6,  G06F: 2  },
    速腾聚创: { G01S: 74, H01S: 17, G06V: 7,  G06F: 2  },
  },
};

/** 技术热词 Tab */
export const LANDSCAPE_HOTWORDS = {
  wordCloud: [
    { word: "FMCW激光雷达",  weight: 95 },
    { word: "固态激光雷达",  weight: 91 },
    { word: "点云处理",      weight: 88 },
    { word: "3D目标检测",    weight: 84 },
    { word: "SLAM",          weight: 79 },
    { word: "时序点云",      weight: 72 },
    { word: "体素化",        weight: 67 },
    { word: "稀疏卷积",      weight: 63 },
    { word: "深度补全",      weight: 58 },
    { word: "多回波",        weight: 52 },
    { word: "905nm/1550nm",  weight: 48 },
    { word: "OPA相控阵",     weight: 41 },
  ],
};

/** 技术现状 Tab */
export const LANDSCAPE_STATUS = {
  legalStatus: { active: 44, expired: 13, pending: 43 },
  byAuthority: { CN: 58, US: 26, EP: 11, WO: 5 },
};

/** 竞争格局 Tab */
export const LANDSCAPE_COMPETITION = {
  hhi: 0.17,
  dominantPlayer: "华为",
  competitionLevel: "medium" as const,
  whiteSpaces: [
    {
      area: "FMCW 激光雷达量产",
      reason: "高校/研究所专利多但产业化专利稀少，工程化路线仍空白",
    },
    {
      area: "多传感器时空同步校正",
      reason: "现有方案多数是离线标定，实时在线标定专利 < 15%",
    },
  ],
  barriers: [
    {
      area: "MEMS 固态扫描",
      reason: "华为/禾赛 HHI 0.29，核心专利集中在扫描机构和光束控制",
    },
    {
      area: "点云目标检测",
      reason: "Waymo/Velodyne 近 5 年活跃授权占比 > 40%",
    },
  ],
};
