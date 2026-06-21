/**
 * PatsnapAnalyticsProvider — 智慧芽分析 API（A 系列）实现
 *
 * 实现 AnalyticsProvider 接口，调用智慧芽 Insights OpenAPI：
 * - A001: 专利趋势分析  POST /insights-openapi/patent-trends-query
 * - A002: 创新词云      POST /insights/word-cloud-query
 * - A007: 申请人排名    GET  /insights/applicant-ranking
 * - A008: 简单法律状态  GET  /insights/simple-legal-status
 *
 * 创新雷达（A102）暂未实测，返回空数据。
 */

import type {
  AnalyticsProvider,
  TrendData,
  WordCloudItem,
  ApplicantRanking,
  InnovationRadar,
} from "@/lib/providers/analytics-types";

// ===== 端点常量 =====

const ANALYTICS_ENDPOINTS = {
  A001: "/insights-openapi/patent-trends-query",
  A002: "/insights/word-cloud-query",
  A007: "/insights/applicant-ranking",
  A008: "/insights/simple-legal-status",
} as const;

// ===== API 响应形状 =====

interface PatSnapEnvelope<T> {
  status: boolean;
  error_code: number;
  error_msg?: string;
  data: T;
}

/** A001 趋势数据点 */
interface RawTrendPoint {
  year: string;
  application: number;
  granted: number;
  percentage: number;
}

/** A002 词云条目 */
interface RawWordCloudItem {
  name: string;
  count: number;
}

/** A007 申请人 */
interface RawApplicantItem {
  applicant: string;
  count: number;
  percentage: number;
}

/** A008 法律状态条目（simple_legal_status 为数字代码字符串，非数组） */
interface RawLegalStatusItem {
  simple_legal_status: string | string[];
  count: number;
  percentage: number;
}

// ===== 映射函数 =====

function mapTrend(raw: RawTrendPoint): TrendData {
  return {
    year: parseInt(raw.year, 10),
    applicationCount: raw.application,
    grantCount: raw.granted,
    grantRate: raw.percentage,
  };
}

function mapWordCloud(raw: RawWordCloudItem): WordCloudItem {
  return {
    word: raw.name,
    weight: raw.count,
  };
}

function mapApplicant(raw: RawApplicantItem, index: number): ApplicantRanking {
  return {
    applicant: raw.applicant,
    count: raw.count,
    rank: index + 1,
  };
}

/**
 * 法律状态代码 → 英文 key
 *
 * A008 返回 simple_legal_status 为数字代码（string）：
 * - "1"       有效 (active)
 * - "2"       失效 (expired)
 * - "220/221" 审中 (pending)
 * - "0/9/999" 未知 (unknown)
 *
 * P041 返回 simple_legal_status 为中文数组（兼容旧逻辑）。
 */
function mapLegalStatusKey(raw: string): string {
  // A008 数字代码映射
  if (raw === "1") return "active";
  if (raw === "2") return "expired";
  if (raw === "220" || raw === "221") return "pending";
  if (raw === "0" || raw === "9" || raw === "999") return "unknown";

  // P041 中文映射（兼容）
  if (raw.includes("有效") || raw.toLowerCase() === "active") return "active";
  if (raw.includes("审中") || raw.toLowerCase() === "pending") return "pending";
  if (raw.includes("失效") || raw.toLowerCase() === "inactive") return "expired";

  return "unknown";
}

// ===== PatsnapAnalyticsProvider =====

export class PatsnapAnalyticsProvider implements AnalyticsProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://connect.zhihuiya.com";
  }

  private url(path: string, extraParams?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("apikey", this.apiKey);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async post<T>(path: string, body: unknown): Promise<PatSnapEnvelope<T>> {
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[Patsnap Analytics] ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as PatSnapEnvelope<T>;
    if (!json.status) {
      throw new Error(
        `[Patsnap Analytics] ${path} error_code=${json.error_code}: ${json.error_msg ?? "unknown error"}`
      );
    }
    return json;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<PatSnapEnvelope<T>> {
    const res = await fetch(this.url(path, params));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[Patsnap Analytics] ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as PatSnapEnvelope<T>;
    if (!json.status) {
      throw new Error(
        `[Patsnap Analytics] ${path} error_code=${json.error_code}: ${json.error_msg ?? "unknown error"}`
      );
    }
    return json;
  }

  /** 构建 analytics 检索式（分析 API 用原始关键词，不加 TACD_ALL 包装） */
  private buildQueryText(keywords: string): string {
    // 分析 API (A001/A002) 与搜索 API (P002) 的 query_text 格式不同：
    // 搜索 API 需要 TACD_ALL:(...) 格式，分析 API 直接接受关键词
    return keywords;
  }

  // ── A001: 专利趋势 ──

  async getTrend(queryText: string): Promise<TrendData[]> {
    const body = {
      query_text: this.buildQueryText(queryText),
      collapse_type: "DOCDB",
      collapse_by: "PBD",
      collapse_order: "LATEST",
    };

    const env = await this.post<RawTrendPoint[]>(ANALYTICS_ENDPOINTS.A001, body);
    return (env.data ?? []).map(mapTrend);
  }

  // ── A002: 创新词云 ──

  async getWordCloud(queryText: string): Promise<WordCloudItem[]> {
    const body = {
      query_text: this.buildQueryText(queryText),
      collapse_type: "DOCDB",
      collapse_by: "PBD",
      collapse_order: "LATEST",
      lang: "cn",
    };

    const env = await this.post<RawWordCloudItem[]>(ANALYTICS_ENDPOINTS.A002, body);
    return (env.data ?? []).map(mapWordCloud);
  }

  // ── A007: 申请人排名 ──

  async getApplicantRanking(queryText: string): Promise<ApplicantRanking[]> {
    const keywords = queryText;
    const params: Record<string, string> = {
      keywords,
      lang: "cn",
    };

    const env = await this.get<RawApplicantItem[]>(ANALYTICS_ENDPOINTS.A007, params);
    return (env.data ?? []).map((item, i) => mapApplicant(item, i));
  }

  // ── A008: 法律状态统计 ──

  async getLegalStatusStats(queryText: string): Promise<Record<string, number>> {
    const keywords = queryText;
    const params: Record<string, string> = {
      keywords,
    };

    const env = await this.get<RawLegalStatusItem[]>(ANALYTICS_ENDPOINTS.A008, params);
    const stats: Record<string, number> = {};
    for (const item of env.data ?? []) {
      // A008 返回：simple_legal_status 为单个数字代码字符串（如 "2"），每项带 count
      // 不同于 P041（返回中文数组）
      const raw = typeof item.simple_legal_status === "string"
        ? item.simple_legal_status
        : (Array.isArray(item.simple_legal_status) ? item.simple_legal_status[0] : "");
      const key = mapLegalStatusKey(raw);
      stats[key] = (stats[key] ?? 0) + (item.count ?? 1);
    }
    return stats;
  }

  // ── 创新雷达（暂未实现）──

  async getInnovationRadar(companyName: string): Promise<InnovationRadar> {
    // A102 企业创新战略雷达图 尚未实测，返回占位数据
    return {
      companyName,
      dimensions: [
        { name: "感知", score: 50 },
        { name: "规划", score: 50 },
        { name: "控制", score: 50 },
        { name: "数据闭环", score: 50 },
        { name: "芯片", score: 50 },
      ],
    };
  }
}
