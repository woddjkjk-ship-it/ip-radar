/**
 * MockProvider — 读 fixtures JSON 提供兜底数据
 *
 * 为什么参数化：Demo 需要对任意合理输入都能跑通，
 * 不能永远返回固定的 4 条。用 query hash 决定返回顺序/子集。
 *
 * Mock 只读 fixtures，不引用任何网络代码。
 */

import type { Claim, MonitorUpdate, PatentDetail, PatentSummary, SearchResult } from "@/lib/types";
import type {
  PatentDataProvider,
  PatentSearchQuery,
  SemanticSearchQuery,
  CompanySearchQuery,
  ProviderKind,
} from "@/lib/providers/types";
import { simpleHash } from "@/lib/utils";

// fixtures JSON 通过 tsconfig resolveJsonModule 导入
import seedPatents from "@/fixtures/patents/seed.json";
import mockSearches from "@/fixtures/searches/mock-searches.json";
import { DEMO_PN_PATENTS } from "@/fixtures/patents-pn-demo";

/** 将 seed.json + mock-searches 中的专利合并为 Map<patentId, PatentDetail> */
function buildPatentMap(): Map<string, PatentDetail> {
  const map = new Map<string, PatentDetail>();

  // 1. seed.json（完整 PatentDetail，含权利要求）
  for (const p of seedPatents as PatentDetail[]) {
    map.set(p.patentId, p);
  }

  // 2. mock-searches 中的搜索结果（PatentSummary，构造为降级 PatentDetail）
  const allSearchItems: PatentSummary[] = [
    ...((mockSearches as Record<string, unknown>).keyword as { results: PatentSummary[] })?.results ?? [],
    ...((mockSearches as Record<string, unknown>).semantic as { results: PatentSummary[] })?.results ?? [],
  ];
  // 公司搜索结果
  const companies = (mockSearches as Record<string, unknown>).companies as Record<string, { results: PatentSummary[] }> | undefined;
  if (companies) {
    for (const entry of Object.values(companies)) {
      allSearchItems.push(...(entry.results ?? []));
    }
  }

  for (const item of allSearchItems) {
    if (!map.has(item.patentId)) {
      map.set(item.patentId, {
        patentId: item.patentId,
        pn: item.pn,
        apno: item.apno,
        title: item.title,
        originalAssignee: item.originalAssignee,
        currentAssignee: item.currentAssignee,
        inventor: item.inventor,
        apdt: item.apdt,
        pbdt: item.pbdt,
        authority: item.authority,
        abstract: "",
        claims: [],
        legalStatus: "unknown",
      });
    }
  }

  return map;
}

/** 用 hash 做稳定打散，返回前 N 条 */
function pickByHash<T>(items: T[], seed: number, limit: number): T[] {
  // Fisher-Yates shuffle with seeded random
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) | 0;
    const j = ((s >>> 0) % (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}

export class MockProvider implements PatentDataProvider {
  readonly kind: ProviderKind = "mock";
  private patentMap: Map<string, PatentDetail>;

  constructor() {
    this.patentMap = buildPatentMap();
  }

  // ── 搜索类（参数化：按 query hash 打散后返回子集）──

  async searchByKeyword(q: PatentSearchQuery): Promise<SearchResult> {
    const all = (mockSearches.keyword.results as PatentSummary[]);
    const seed = simpleHash(q.queryText);
    const limit = q.limit ?? 10;
    return {
      total: all.length,
      results: pickByHash(all, seed, limit),
    };
  }

  async searchBySemantic(q: SemanticSearchQuery): Promise<SearchResult> {
    const all = (mockSearches.semantic.results as PatentSummary[]);
    const seed = simpleHash(q.queryText);
    const limit = q.limit ?? 10;
    return {
      total: all.length,
      results: pickByHash(all, seed, limit),
    };
  }

  async searchByCompany(q: CompanySearchQuery): Promise<SearchResult> {
    const companies = mockSearches.companies as Record<string, { total: number; results: PatentSummary[] }>;
    const entry = companies[q.assignee];
    if (!entry) {
      return { total: 0, results: [] };
    }
    const seed = simpleHash(q.assignee + (q.offset ?? 0));
    const limit = q.limit ?? 10;
    return {
      total: entry.total,
      results: pickByHash(entry.results, seed, limit),
    };
  }

  async searchByPn(_pns: string[], limit?: number): Promise<SearchResult> {
    const results = DEMO_PN_PATENTS as PatentSummary[];
    const capped = limit != null ? results.slice(0, limit) : results;
    return {
      total: results.length,
      results: capped,
    };
  }

  async countByQuery(queryText: string): Promise<number> {
    const counts = mockSearches.counts as Record<string, number>;
    return counts[queryText] ?? 41193; // 默认值模拟
  }

  // ── 详情类 ──

  async getDetail(patentId: string): Promise<PatentDetail> {
    const patent = this.patentMap.get(patentId);
    if (!patent) {
      throw new Error(`[MockProvider] patent not found: ${patentId}`);
    }
    return patent;
  }

  async getClaims(patentId: string): Promise<Claim[]> {
    const detail = await this.getDetail(patentId);
    return detail.claims;
  }

  async getLegalStatus(patentId: string): Promise<string> {
    const detail = await this.getDetail(patentId);
    return detail.legalStatus;
  }

  // ── PDF 类 ──

  async getPdfUrl(pn: string): Promise<string> {
    return `/demo-patents/${pn}.pdf`;
  }

  // ── 监控类 ──

  async createMonitor(_name: string, _queryText: string): Promise<string> {
    return `mock-monitor-${Date.now()}`;
  }

  async checkMonitorUpdates(_monitorId: string): Promise<MonitorUpdate[]> {
    return [
      {
        monitorName: "自动驾驶感知融合监控",
        patentCount: 2,
        patentIds: [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440003",
        ],
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}
