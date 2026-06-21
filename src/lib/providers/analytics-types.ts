/**
 * AnalyticsProvider 抽象接口 — 标品模块（技术布局/趋势/词云）用
 *
 * 对标品模块提供分析型数据：趋势、词云、申请人排名、创新雷达等。
 * Mock 实现读 fixtures JSON 渲染；Live 实现调智慧芽 A 系列 DATA API。
 */

// ===== 数据模型 =====

/** 趋势数据点 */
export interface TrendData {
  year: number;
  applicationCount: number;
  grantCount: number;
  grantRate: number;
}

/** 词云条目 */
export interface WordCloudItem {
  word: string;
  weight: number;
}

/** 申请人排名 */
export interface ApplicantRanking {
  applicant: string;
  count: number;
  rank: number;
}

/** 创新雷达（技术布局雷达图） */
export interface InnovationRadar {
  companyName: string;
  dimensions: {
    name: string;
    score: number; // 0-100
  }[];
}

// ===== Provider 接口 =====

export interface AnalyticsProvider {
  /** 专利趋势（按年份统计） */
  getTrend(queryText: string): Promise<TrendData[]>;
  /** 技术词云 */
  getWordCloud(queryText: string): Promise<WordCloudItem[]>;
  /** 申请人排名 */
  getApplicantRanking(queryText: string): Promise<ApplicantRanking[]>;
  /** 企业创新雷达 */
  getInnovationRadar(companyName: string): Promise<InnovationRadar>;
  /** 法律状态统计 */
  getLegalStatusStats(queryText: string): Promise<Record<string, number>>;
}
