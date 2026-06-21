/**
 * AnalyticsMockProvider — 标品模块（技术布局/趋势/词云）的 Mock 实现
 *
 * 返回硬编码的自动驾驶领域分析数据，用于 Mock 模式下图表渲染。
 */

import type {
  AnalyticsProvider,
  TrendData,
  WordCloudItem,
  ApplicantRanking,
  InnovationRadar,
} from "@/lib/providers/analytics-types";

/** 自动驾驶领域硬编码趋势数据 */
const MOCK_TREND: TrendData[] = [
  { year: 2018, applicationCount: 3200, grantCount: 1800, grantRate: 0.56 },
  { year: 2019, applicationCount: 4500, grantCount: 2400, grantRate: 0.53 },
  { year: 2020, applicationCount: 5800, grantCount: 3100, grantRate: 0.53 },
  { year: 2021, applicationCount: 7200, grantCount: 3800, grantRate: 0.53 },
  { year: 2022, applicationCount: 9100, grantCount: 4600, grantRate: 0.51 },
  { year: 2023, applicationCount: 10800, grantCount: 5200, grantRate: 0.48 },
  { year: 2024, applicationCount: 12500, grantCount: 6000, grantRate: 0.48 },
  { year: 2025, applicationCount: 14000, grantCount: 6800, grantRate: 0.49 },
];

/** 自动驾驶领域硬编码词云 */
const MOCK_WORD_CLOUD: WordCloudItem[] = [
  { word: "传感器融合", weight: 3420 },
  { word: "深度学习", weight: 2980 },
  { word: "激光雷达", weight: 2650 },
  { word: "目标检测", weight: 2410 },
  { word: "路径规划", weight: 2180 },
  { word: "注意力机制", weight: 1950 },
  { word: "知识蒸馏", weight: 1720 },
  { word: "端到端", weight: 1580 },
  { word: "强化学习", weight: 1340 },
  { word: "Transformer", weight: 1200 },
  { word: "BEV感知", weight: 980 },
  { word: "占用网络", weight: 760 },
];

/** 自动驾驶领域申请人排名 */
const MOCK_RANKING: ApplicantRanking[] = [
  { applicant: "Waymo LLC", count: 2850, rank: 1 },
  { applicant: "Toyota Motor Corp", count: 2420, rank: 2 },
  { applicant: "华为技术有限公司", count: 1980, rank: 3 },
  { applicant: "Tesla, Inc.", count: 1650, rank: 4 },
  { applicant: "Robert Bosch GmbH", count: 1420, rank: 5 },
  { applicant: "Baidu Apollo", count: 1280, rank: 6 },
  { applicant: "Mobileye", count: 1150, rank: 7 },
  { applicant: "Nvidia Corp", count: 980, rank: 8 },
];

/** 企业创新雷达 */
const MOCK_RADAR: Record<string, InnovationRadar> = {
  Tesla: {
    companyName: "Tesla",
    dimensions: [
      { name: "感知", score: 85 },
      { name: "规划", score: 78 },
      { name: "控制", score: 72 },
      { name: "数据闭环", score: 90 },
      { name: "芯片", score: 88 },
    ],
  },
  Waymo: {
    companyName: "Waymo",
    dimensions: [
      { name: "感知", score: 92 },
      { name: "规划", score: 88 },
      { name: "控制", score: 80 },
      { name: "数据闭环", score: 85 },
      { name: "芯片", score: 65 },
    ],
  },
};

/** 法律状态统计 */
const MOCK_LEGAL_STATS: Record<string, number> = {
  active: 65,
  pending: 22,
  expired: 10,
  unknown: 3,
};

export class AnalyticsMockProvider implements AnalyticsProvider {
  async getTrend(_queryText: string): Promise<TrendData[]> {
    return MOCK_TREND;
  }

  async getWordCloud(_queryText: string): Promise<WordCloudItem[]> {
    return MOCK_WORD_CLOUD;
  }

  async getApplicantRanking(_queryText: string): Promise<ApplicantRanking[]> {
    return MOCK_RANKING;
  }

  async getInnovationRadar(companyName: string): Promise<InnovationRadar> {
    // 对已知企业返回预置雷达，未知企业返回默认
    if (MOCK_RADAR[companyName]) {
      return MOCK_RADAR[companyName];
    }
    return {
      companyName,
      dimensions: [
        { name: "感知", score: 60 },
        { name: "规划", score: 55 },
        { name: "控制", score: 50 },
        { name: "数据闭环", score: 45 },
        { name: "芯片", score: 40 },
      ],
    };
  }

  async getLegalStatusStats(_queryText: string): Promise<Record<string, number>> {
    return MOCK_LEGAL_STATS;
  }
}
