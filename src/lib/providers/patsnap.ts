/**
 * PatsnapProvider — 智慧芽 DATA API 完整实现
 *
 * 为什么直接实现：API 端点和请求/响应格式已在 Round 1 测试中实测确认。
 * 基址 https://connect.zhihuiya.com，鉴权用 URL 参数 ?apikey=xxx。
 *
 * 关键翻车点：
 * - 搜索响应字段是 snake_case（patent_id/original_assignee）→ 需映射为驼峰
 * - P018 权利要求是 HTML 格式 → 需 strip 标签后解析
 * - P041 法律状态是中文（"有效"/"失效"）→ 需映射为英文枚举
 * - P012 响应是数组 data[0].bibliographic_data → 需提取 abstracts
 * - P004 请求字段名是 application 不是 query_text
 *
 * 监控类端点尚未实测，暂 throw not implemented。
 */

import type { Claim, LegalStatus, MonitorUpdate, PatentDetail, PatentSummary, SearchResult } from "@/lib/types";
import type {
  PatentDataProvider,
  PatentSearchQuery,
  SemanticSearchQuery,
  CompanySearchQuery,
  ProviderKind,
} from "@/lib/providers/types";

// ===== 常量 =====

const DEFAULT_BASE_URL = "https://connect.zhihuiya.com";

/** API 端点映射 */
const ENDPOINTS = {
  P001: "/search/patent/query-search-count/v2",
  P002: "/search/patent/query-search-patent/v2",
  P004: "/search/patent/company-search-patent/v2",
  P008: "/search/patent/semantic-search-patent/v2",
  P012: "/basic-patent-data/bibliography",
  P018: "/basic-patent-data/claim-data",
  P020: "/basic-patent-data/pdf-data",
  P041: "/basic-patent-data/simple-legal-status",
  P069: "/search/patent/patent-search-pn",
} as const;

/** 智慧芽 API 响应信封 */
interface PatSnapEnvelope<T> {
  status: boolean;
  error_code: number;
  error_msg?: string;
  data: T;
}

// ===== 蛇形 → 驼峰映射 =====

/** 智慧芽搜索 API 返回的蛇形字段 */
interface PatSnapSearchItem {
  patent_id: string;
  pn: string;
  apno: string;
  title: string;
  original_assignee: string;
  current_assignee: string;
  inventor: string;
  apdt: number;
  pbdt: number;
  authority: string;
}

function mapSearchItem(item: PatSnapSearchItem): PatentSummary {
  return {
    patentId: item.patent_id,
    pn: item.pn,
    apno: item.apno,
    title: item.title,
    originalAssignee: item.original_assignee,
    currentAssignee: item.current_assignee,
    inventor: item.inventor,
    apdt: item.apdt,
    pbdt: item.pbdt,
    authority: item.authority,
  };
}

/** 从专利号前缀推导受理局代码（如 CN117423077A → CN） */
function deriveAuthority(pn: string): string {
  const m = pn.match(/^([A-Z]{2})/);
  return m ? m[1] : "";
}

// ===== 法律状态映射 =====

function mapLegalStatus(raw: string[]): LegalStatus {
  if (raw.length === 0) return "unknown";
  const s = raw[0];
  if (s.includes("有效") || s.toLowerCase() === "active" || s.toLowerCase() === "granted") {
    return "active";
  }
  if (s.includes("失效") || s.toLowerCase() === "expired" || s.toLowerCase() === "lapsed") {
    return "expired";
  }
  if (s.includes("审中") || s.includes("公开") || s.toLowerCase() === "pending") {
    return "pending";
  }
  return "unknown";
}

// ===== HTML 权利要求解析 =====

/**
 * 从 P018 返回的 HTML claim_text 中提取纯文本和独立权利要求判定。
 *
 * claim_text 格式示例：
 * `<div class="indep-clm" num="1"><seg-con>1. A method </seg-con>...</div>`
 *
 * class="indep-clm" 表示独立权利要求，class="dep-clm" 表示从属。
 */
function parseClaimHtml(html: string): { number: number; isIndependent: boolean; text: string }[] {
  // 按 <div> 分割，每个 div 是一条权利要求
  const divRegex = /<div\s+class="([^"]*)"\s+num="(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
  const claims: { number: number; isIndependent: boolean; text: string }[] = [];
  let match;

  while ((match = divRegex.exec(html)) !== null) {
    const className = match[1];
    const num = parseInt(match[2], 10);
    const rawContent = match[3];

    // 移除 seg-* 标签，保留纯文本
    const text = rawContent
      .replace(/<seg-[^>]*>/g, "")
      .replace(/<\/seg-[^>]*>/g, "")
      .replace(/<[^>]+>/g, "") // 残余标签
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .trim();

    claims.push({
      number: num,
      isIndependent: className.includes("indep"),
      text,
    });
  }

  return claims;
}

/** 从 claim_text 中提取纯文本并构建 Claim 数组 */
function extractClaims(html: string): Claim[] {
  const parsed = parseClaimHtml(html);
  return parsed.map((c) => ({
    number: c.number,
    isIndependent: c.isIndependent,
    text: c.text,
  }));
}

// ===== PatsnapProvider =====

export class PatsnapProvider implements PatentDataProvider {
  readonly kind: ProviderKind = "patsnap";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? DEFAULT_BASE_URL;
  }

  // ── 通用 fetch 封装 ──

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
      throw new Error(`[Patsnap] ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as PatSnapEnvelope<T>;
    if (!json.status) {
      throw new Error(
        `[Patsnap] ${path} error_code=${json.error_code}: ${json.error_msg ?? "unknown error"}`
      );
    }
    return json;
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<PatSnapEnvelope<T>> {
    const res = await fetch(this.url(path, params));
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[Patsnap] ${path} returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as PatSnapEnvelope<T>;
    if (!json.status) {
      throw new Error(
        `[Patsnap] ${path} error_code=${json.error_code}: ${json.error_msg ?? "unknown error"}`
      );
    }
    return json;
  }

  // ── 搜索类 ──

  async searchByKeyword(q: PatentSearchQuery): Promise<SearchResult> {
    const body: Record<string, unknown> = {
      query_text: q.queryText,
      collapse_type: q.collapseType ?? "DOCDB",
      collapse_by: "PBD",
      collapse_order: "LATEST",
      limit: q.limit ?? 10,
      offset: q.offset ?? 0,
      sort: [{ field: "SCORE", order: "DESC" }],
      stemming: 0,
    };

    const env = await this.post<{
      result_count: number;
      total_search_result_count: number;
      results: PatSnapSearchItem[];
    }>(ENDPOINTS.P002, body);

    return {
      total: env.data.total_search_result_count,
      results: (env.data.results ?? []).map(mapSearchItem),
    };
  }

  async searchBySemantic(q: SemanticSearchQuery): Promise<SearchResult> {
    const body: Record<string, unknown> = {
      text: q.queryText,
      field: "RELEVANCY",
      limit: q.limit ?? 10,
      offset: q.offset ?? 0,
    };

    const env = await this.post<{
      result_count: number;
      total_search_result_count: number;
      results: PatSnapSearchItem[];
    }>(ENDPOINTS.P008, body);

    return {
      total: env.data.total_search_result_count,
      results: (env.data.results ?? []).map(mapSearchItem),
    };
  }

  async searchByCompany(q: CompanySearchQuery): Promise<SearchResult> {
    // P004 使用 application 字段而非 query_text
    const body: Record<string, unknown> = {
      application: q.assignee,
      collapse_type: q.collapseType ?? "DOCDB",
      collapse_by: "PBD",
      collapse_order: "LATEST",
      limit: q.limit ?? 10,
      offset: q.offset ?? 0,
      sort: [{ field: "SCORE", order: "DESC" }],
    };

    const env = await this.post<{
      result_count: number;
      total_search_result_count: number;
      results: PatSnapSearchItem[];
    }>(ENDPOINTS.P004, body);

    return {
      total: env.data.total_search_result_count,
      results: (env.data.results ?? []).map(mapSearchItem),
    };
  }

  async searchByPn(pns: string[], limit?: number): Promise<SearchResult> {
    // 专利号检索：使用 P069 端点，支持单/多 PN 并行查询
    const cleaned = pns.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return { total: 0, results: [] };
    }

    const effectiveLimit = limit ?? cleaned.length;

    // 并行查询每个专利号
    const results = await Promise.all(
      cleaned.map((pn) =>
        this.post<{
          result_count: number;
          total_search_result_count: number;
          results: PatSnapSearchItem[];
        }>(ENDPOINTS.P069, { pn, limit: 1 })
          .then((env) => env.data.results ?? [])
          .catch((err) => {
            console.error(`[Patsnap] P069 query failed for ${pn}:`, err);
            return [];
          }),
      ),
    );

    const flat = results.flat().slice(0, effectiveLimit);
    return {
      total: flat.length,
      results: flat.map((item) => ({
        ...mapSearchItem(item),
        // P069 响应不含 authority 字段，从 PN 前缀推导
        authority: item.authority ?? deriveAuthority(item.pn),
      })),
    };
  }

  async countByQuery(queryText: string): Promise<number> {
    const body = {
      query_text: queryText,
      collapse_type: "DOCDB",
      collapse_by: "PBD",
      collapse_order: "LATEST",
      stemming: 0,
    };

    const env = await this.post<{ total_search_result_count: number }>(ENDPOINTS.P001, body);
    return env.data.total_search_result_count;
  }

  // ── 详情类 ──

  async getDetail(patentId: string): Promise<PatentDetail> {
    // 并行获取著录项目 + 权利要求 + 法律状态
    const [biblioEnv, claimsEnv, legalEnv] = await Promise.all([
      this.get<unknown[]>(ENDPOINTS.P012, { patent_id: patentId }),
      this.get<unknown[]>(ENDPOINTS.P018, { patent_id: patentId }),
      this.get<unknown[]>(ENDPOINTS.P041, { patent_id: patentId }),
    ]);

    // 从 P012 提取摘要和著录项目
    // P012 响应结构：data[0] 顶层只有 patent_id + pn + bibliographic_data
    // 所有著录字段在 bibliographic_data 的子对象中
    const biblioItem = (biblioEnv.data as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;
    const bd = (biblioItem?.bibliographic_data as Record<string, unknown>) ?? {};

    // 发明名称（取第一个，优先中文）
    const titles = (bd.invention_title as Array<{ lang: string; text: string }>) ?? [];
    const title = titles.find((t) => t.lang === "CN")?.text ?? titles[0]?.text ?? "";

    // 摘要（取第一个，优先中文）
    const abstracts = (bd.abstracts as Array<{ lang: string; text: string; data_format?: string }>) ?? [];
    const abstract = abstracts.find((a) => a.lang === "CN")?.text ?? abstracts[0]?.text ?? "";

    // IPC 分类
    const classification = bd.classification_data as
      | { ipc_classification?: Array<{ ipc_class?: string }> }
      | undefined;
    const ipcClasses = classification?.ipc_classification?.map((c) => c.ipc_class ?? "").filter(Boolean) ?? [];

    // 申请号 + 申请日（从 application_reference）
    const appRef = bd.application_reference as Record<string, unknown> | undefined;
    const apno = (appRef?.doc_number as string) ?? "";
    const apdt = (appRef?.date as number) ?? 0;

    // 公开日 + 受理局（从 publication_reference）
    const pubRef = bd.publication_reference as Record<string, unknown> | undefined;
    const pbdt = (pubRef?.date as number) ?? 0;
    const authority = (pubRef?.country as string) ?? "";

    // 申请人/专利权人/发明人（从 parties）
    const parties = bd.parties as Record<string, unknown> | undefined;
    const applicantList = (parties?.applicants as Array<{ name: string }>) ?? [];
    const assigneeList = (parties?.assignees as Array<{ name: string }>) ?? [];
    const inventorList = (parties?.inventors as Array<{ name: string }>) ?? [];
    const originalAssignee = applicantList.map((a) => a.name).join("|");
    const currentAssignee = assigneeList.length > 0
      ? assigneeList.map((a) => a.name).join("|")
      : originalAssignee; // 若 assignees 为空，回退到 applicants
    const inventor = inventorList.map((i) => i.name).join("|");

    // 从 P018 提取权利要求
    const claimsItem = (claimsEnv.data as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;
    const claimsData = (claimsItem?.claims as Array<{ claim_text: string }>) ?? [];
    let claims: Claim[] = [];
    if (claimsData.length > 0 && claimsData[0].claim_text) {
      claims = extractClaims(claimsData[0].claim_text);
    }

    // 从 P041 提取法律状态
    const legalItem = (legalEnv.data as Record<string, unknown>[])?.[0] as Record<string, unknown> | undefined;
    const rawStatus = (legalItem?.simple_legal_status as string[]) ?? [];
    const legalStatus = mapLegalStatus(rawStatus);

    return {
      patentId: (biblioItem?.patent_id as string) ?? patentId,
      pn: (biblioItem?.pn as string) ?? "",
      apno,
      title,
      originalAssignee,
      currentAssignee,
      inventor,
      apdt,
      pbdt,
      authority,
      abstract,
      claims,
      legalStatus,
      ipcClasses: ipcClasses.length > 0 ? ipcClasses : undefined,
      familySize: undefined,
    };
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

  /**
   * P020 — 获取专利 PDF 签名 URL。
   * GET /basic-patent-data/pdf-data?patent_number=xxx
   * 响应 data[0].pdf.path 为签名 URL（有效 10 天）。
   * 若当前专利 PDF 不可用，可能返回同族专利替代（pn_related 字段）。
   */
  async getPdfUrl(pn: string): Promise<string> {
    const env = await this.get<Array<{ pn: string; pdf: { path: string }; patent_id: string; pn_related?: string }>>(
      ENDPOINTS.P020,
      { patent_number: pn },
    );
    const item = env.data?.[0];
    if (!item?.pdf?.path) {
      throw new Error(`[Patsnap] P020: no PDF available for ${pn}`);
    }
    return item.pdf.path;
  }

  // ── 监控类（待实测）──

  async createMonitor(_name: string, _queryText: string): Promise<string> {
    throw new Error("[Patsnap] createMonitor not yet implemented — endpoint pending verification");
  }

  async checkMonitorUpdates(_monitorId: string): Promise<MonitorUpdate[]> {
    throw new Error("[Patsnap] checkMonitorUpdates not yet implemented — endpoint pending verification");
  }
}
