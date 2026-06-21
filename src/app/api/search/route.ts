/**
 * GET /api/search — 多模式专利检索（含高级筛选）
 *
 * Query params:
 *   q: string          检索式/自然语言描述/企业名
 *   mode: keyword|semantic|company|pn (default: keyword)
 *   page: number       默认 1
 *   limit: number      默认 10
 *   apd_start: number  申请日起始 (YYYYMMDD)
 *   apd_end: number    申请日截止 (YYYYMMDD)
 *   authority: string  受理局过滤（逗号分隔）
 *   assignee: string   申请人过滤
 *   legal_status: string 法律状态过滤
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/providers";

const QuerySchema = z.object({
  q: z.string().min(1),
  mode: z.enum(["keyword", "semantic", "company", "pn"]).default("keyword"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
  apd_start: z.coerce.number().optional(),
  apd_end: z.coerce.number().optional(),
  authority: z.string().optional(),
  assignee: z.string().optional(),
  legal_status: z.string().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { q, mode, limit, apd_start, apd_end, authority, assignee, legal_status } = parsed.data;
  const { provider, fallbackTriggered, fallbackReason } = await getProvider();

  try {
    let result;
    if (mode === "keyword") {
      result = await provider.searchByKeyword({ queryText: q, limit });
    } else if (mode === "semantic") {
      result = await provider.searchBySemantic({ queryText: q, limit });
    } else if (mode === "pn") {
      const pns = q.split(",").map((s) => s.trim()).filter(Boolean);
      result = await provider.searchByPn(pns, limit);
    } else {
      // mode === "company"
      result = await provider.searchByCompany({ assignee: q, limit });
    }

    // 高级筛选：在服务端对结果进行过滤
    let filtered = result.results;
    if (apd_start != null) {
      filtered = filtered.filter((p) => p.apdt >= apd_start);
    }
    if (apd_end != null) {
      filtered = filtered.filter((p) => p.apdt <= apd_end);
    }
    if (authority) {
      const authSet = new Set(authority.split(",").map((s) => s.trim().toUpperCase()));
      filtered = filtered.filter((p) => authSet.has(p.authority.toUpperCase()));
    }
    if (assignee) {
      const q = assignee.toLowerCase();
      filtered = filtered.filter((p) => p.originalAssignee.toLowerCase().includes(q));
    }
    // 注意: legal_status 在 PatentSummary 中不存在，此处跳过

    // Patsnap 端点编号映射
    const endpointMap: Record<string, string> = {
      keyword: "P002",
      semantic: "P008",
      company: "P004",
      pn: "P069",
    };

    const response = NextResponse.json({
      total: filtered.length,
      results: filtered,
      mode,
      _dataSource: provider.kind,
      _endpoint: endpointMap[mode] ?? "P002",
      _filtered: filtered.length !== result.results.length,
    });
    response.headers.set("X-Data-Source", provider.kind);
    if (fallbackTriggered) {
      response.headers.set("X-Fallback-Reason", fallbackReason ?? "unknown");
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
