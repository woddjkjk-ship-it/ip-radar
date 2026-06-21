/**
 * BEV 感知技术布局 Mock 数据 — 全 5 个 Tab
 *
 * Mock 模式下 GET /api/landscape 统一返回此数据。
 * 不论 q 参数值，均使用同一份丰富数据（普适性 > 剧本）。
 */

/** 趋势 Tab（A001） */
export const LANDSCAPE_TREND = {
  years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  applications: [312, 445, 623, 891, 1124, 1456, 987, 423],
  grants: [180, 256, 389, 512, 687, 892, 634, 198],
  byCn: [201, 298, 412, 589, 743, 982, 654, 298],
  byUs: [68, 89, 123, 187, 243, 312, 215, 89],
  byEp: [43, 58, 88, 115, 138, 162, 118, 36],
};

/** 主要玩家 Tab（A007 + A103） */
export const LANDSCAPE_PLAYERS = {
  ranking: [
    { name: "Waymo", count: 1234, yoy: "+12%", topIpc: "G06V" },
    { name: "Tesla", count: 987, yoy: "+23%", topIpc: "G06V" },
    { name: "华为车BU", count: 876, yoy: "+45%", topIpc: "G06V" },
    { name: "Mobileye", count: 743, yoy: "+8%", topIpc: "G01S" },
    { name: "Nvidia", count: 621, yoy: "+31%", topIpc: "G06F" },
    { name: "小鹏", count: 456, yoy: "+67%", topIpc: "G06V" },
    { name: "地平线", count: 398, yoy: "+55%", topIpc: "G06V" },
  ],
  techComposition: {
    Waymo: { G06V: 45, G01S: 30, G06F: 15, B60W: 10 },
    Tesla: { G06V: 60, G06F: 25, B60W: 15, G01S: 0 },
    "华为车BU": { G06V: 40, G01S: 25, H04W: 20, B60W: 15 },
  },
};

/** 技术热词 Tab（A002 + A012） */
export const LANDSCAPE_HOTWORDS = {
  wordCloud: [
    { word: "多模态融合", weight: 100 },
    { word: "BEV特征", weight: 85 },
    { word: "时空注意力", weight: 72 },
    { word: "点云体素化", weight: 68 },
    { word: "知识蒸馏", weight: 61 },
    { word: "实时推理", weight: 55 },
    { word: "占用预测", weight: 48 },
    { word: "数据增强", weight: 43 },
    { word: "Transformer", weight: 38 },
    { word: "跨模态对齐", weight: 35 },
    { word: "运动预测", weight: 30 },
    { word: "目标检测", weight: 28 },
    { word: "深度估计", weight: 24 },
    { word: "轨迹规划", weight: 20 },
    { word: "雷达点云", weight: 18 },
  ],
  techEffect: [
    { tech: "多模态融合", effect: "精度提升", count: 234 },
    { tech: "多模态融合", effect: "鲁棒性增强", count: 189 },
    { tech: "时空注意力", effect: "精度提升", count: 156 },
    { tech: "时空注意力", effect: "速度优化", count: 98 },
    { tech: "知识蒸馏", effect: "速度优化", count: 145 },
    { tech: "知识蒸馏", effect: "成本降低", count: 87 },
  ],
};

/** 技术现状 Tab（A003 + A008 + A005） */
export const LANDSCAPE_STATUS = {
  sunburst: {
    name: "BEV感知",
    children: [
      {
        name: "摄像头感知",
        value: 1823,
        children: [
          { name: "单目", value: 892 },
          { name: "环视", value: 654 },
          { name: "立体", value: 277 },
        ],
      },
      {
        name: "激光雷达感知",
        value: 1456,
        children: [
          { name: "点云分割", value: 756 },
          { name: "3D检测", value: 700 },
        ],
      },
      {
        name: "多模态融合",
        value: 1124,
        children: [
          { name: "前融合", value: 612 },
          { name: "后融合", value: 512 },
        ],
      },
    ],
  },
  legalStatus: { active: 61, expired: 22, pending: 17 },
  topCited: [
    {
      pn: "US10481271B2",
      title: "End-to-end learning for self-driving vehicles",
      assignee: "Waymo",
      citedCount: 234,
    },
    {
      pn: "CN109738910B",
      title: "一种基于激光雷达的三维目标检测方法",
      assignee: "百度",
      citedCount: 187,
    },
    {
      pn: "EP3667611B1",
      title: "Multi-sensor data fusion for autonomous driving",
      assignee: "Mobileye",
      citedCount: 156,
    },
  ],
};

/** 竞争格局 Tab（合成） */
export const LANDSCAPE_COMPETITION = {
  hhi: 0.18,
  dominantPlayer: "Waymo",
  competitionLevel: "medium" as const,
  whiteSpaces: [
    {
      area: "夜间/低能见度BEV感知",
      reason: "现有专利覆盖率 < 15%，技术难度高但需求迫切",
    },
    {
      area: "低算力边缘端BEV",
      reason: "嵌入式设备方案专利稀疏，BPU/EyeQ之外少有系统性布局",
    },
  ],
  barriers: [
    {
      area: "多模态前融合",
      reason: "HHI 0.31，Waymo/Tesla集中度高，Claim覆盖宽泛",
    },
    {
      area: "时序融合与预测",
      reason: "Waymo专利密度最高，近3年活跃授权量占比 > 40%",
    },
  ],
};
