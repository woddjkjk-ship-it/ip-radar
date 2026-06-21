/**
 * 竞品概览静态丰富数据 — 7 家竞品
 *
 * Mock 模式下 GET /api/monitor/competitor-stats 返回此数据。
 * §6.3 升级：repPatent → repPatents（2条代表专利，含 pn 以便 PatentModal 预览）
 */

export interface RepPatent {
  pn: string;
  title: string;
}

export interface CompetitorStat {
  total: number;
  newThisMonth: number;
  trend6m: number[]; // 近 6 个月新增趋势
  coreTech: string[]; // 核心技术领域标签（2-4 个）
  repPatents: RepPatent[]; // 代表专利（2条，可预览）
}

export const COMPETITOR_STATS: Record<string, CompetitorStat> = {
  Tesla: {
    total: 3241,
    newThisMonth: 38,
    trend6m: [20, 35, 28, 45, 52, 38],
    coreTech: ["视觉感知", "端到端", "自动泊车"],
    repPatents: [
      { pn: "US2024123456A1", title: "Camera-only perception system for full self-driving" },
      { pn: "US2024123457A1", title: "End-to-end neural network for autonomous lane changing" },
    ],
  },
  Waymo: {
    total: 5128,
    newThisMonth: 52,
    trend6m: [35, 42, 38, 55, 61, 52],
    coreTech: ["激光雷达", "高精地图", "行为预测"],
    repPatents: [
      { pn: "US2024012345A1", title: "Lidar-based 3D object detection with temporal fusion" },
      { pn: "US2024012345B1", title: "Multi-sensor calibration for autonomous vehicle perception" },
    ],
  },
  "华为车BU": {
    total: 2876,
    newThisMonth: 71,
    trend6m: [28, 45, 62, 78, 85, 71],
    coreTech: ["传感器融合", "车路协同", "OTA"],
    repPatents: [
      { pn: "CN116994312A", title: "多传感器融合智能驾驶感知系统" },
      { pn: "CN116994313A", title: "基于车路协同的自动驾驶决策方法" },
    ],
  },
  Mobileye: {
    total: 1943,
    newThisMonth: 21,
    trend6m: [18, 22, 19, 24, 25, 21],
    coreTech: ["RSS安全模型", "EyeQ芯片", "前向感知"],
    repPatents: [
      { pn: "US2024987654A1", title: "Forward collision warning using monocular camera" },
      { pn: "US2024987655A1", title: "RSS-based safety envelope for highway autopilot" },
    ],
  },
  Nvidia: {
    total: 2134,
    newThisMonth: 44,
    trend6m: [25, 31, 38, 42, 48, 44],
    coreTech: ["GPU推理", "DRIVE平台", "仿真"],
    repPatents: [
      { pn: "US2024555666A1", title: "Neural network acceleration for real-time autonomous perception" },
      { pn: "US2024555667A1", title: "Synthetic data generation for autonomous vehicle training" },
    ],
  },
  小鹏: {
    total: 876,
    newThisMonth: 63,
    trend6m: [18, 28, 38, 48, 55, 63],
    coreTech: ["NGP", "城市辅助驾驶", "XNGP"],
    repPatents: [
      { pn: "CN118765432A", title: "基于高精地图的高速公路导航辅助驾驶方法" },
      { pn: "CN118765433A", title: "城市道路无图自动驾驶路径规划系统" },
    ],
  },
  地平线: {
    total: 654,
    newThisMonth: 57,
    trend6m: [12, 22, 32, 42, 50, 57],
    coreTech: ["BPU架构", "征程芯片", "感知算法"],
    repPatents: [
      { pn: "CN119876543A", title: "面向自动驾驶的边缘AI芯片架构设计" },
      { pn: "CN119876544A", title: "基于BPU的实时目标检测加速方法" },
    ],
  },
};
