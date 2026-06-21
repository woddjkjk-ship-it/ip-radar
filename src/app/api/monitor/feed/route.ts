/**
 * GET /api/monitor/feed — 竞品动态 Feed
 *
 * Query params:
 *   mode: tech | company    默认 tech
 *   topics: string          逗号分隔技术关键词（默认：BEV感知,传感器融合,端到端规划）
 *   companies: string       逗号分隔企业名（默认：Tesla,Waymo）
 *   days: number            时间窗口，默认 30
 *   limit: number           默认 10
 *
 * 模式=tech：遍历 topics，每个 topic 做关键词搜索，合并去重。
 * 模式=company：遍历 companies，每个企业做企业搜索，合并去重。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/providers";
import type { PatentSummary, RiskLevel } from "@/lib/types";

/** 默认关注技术列表（与 localStorage watched-topics 默认值一致） */
const DEFAULT_TOPICS = ["BEV感知", "传感器融合", "端到端规划"];
/** 默认竞品企业 */
const DEFAULT_COMPANIES = ["Tesla", "Waymo"];

const QuerySchema = z.object({
  mode: z.enum(["tech", "company"]).default("tech"),
  topics: z.string().optional(),
  companies: z.string().optional(),
  days: z.coerce.number().min(1).max(365).default(30),
  limit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * 匹配关注主题，返回命中的主题列表和风险等级。
 *
 * 评级规则（与 UI 展示的标签数一致）：
 * - 命中 ≥2 个主题 → High
 * - 命中 1 个主题  → Medium
 * - 命中 0 个主题  → Low
 */
function calcRiskLevel(patent: PatentSummary, topics: string[]): {
  riskLevel: RiskLevel;
  matchedTopics: string[];
} {
  const searchText = `${patent.title ?? ""} ${patent.originalAssignee ?? ""}`.toLowerCase();
  const matchedTopics: string[] = [];

  for (const topic of topics) {
    if (searchText.includes(topic.toLowerCase())) {
      matchedTopics.push(topic);
    }
  }

  const riskLevel: RiskLevel =
    matchedTopics.length >= 2 ? "high" :
    matchedTopics.length === 1 ? "medium" : "low";

  return { riskLevel, matchedTopics };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { mode, topics, companies, limit } = parsed.data;
  const { provider, fallbackTriggered, fallbackReason } = await getProvider();

  // 使用默认值补全
  const topicList = topics
    ? topics.split(",").map((t) => t.trim()).filter(Boolean)
    : DEFAULT_TOPICS;
  const companyList = companies
    ? companies.split(",").map((c) => c.trim()).filter(Boolean)
    : DEFAULT_COMPANIES;

  try {
    const allResults: (PatentSummary & { riskLevel: RiskLevel; matchedTopics: string[] })[] = [];
    const seen = new Set<string>();

    if (mode === "tech") {
      for (const topic of topicList.slice(0, 5)) {
        const r = await provider.searchByKeyword({ queryText: `TACD: ${topic}`, limit: Math.ceil(limit / topicList.length) });
        for (const patent of r.results) {
          if (seen.has(patent.patentId)) continue;
          seen.add(patent.patentId);
          const { riskLevel, matchedTopics } = calcRiskLevel(patent, topicList);
          allResults.push({ ...patent, riskLevel, matchedTopics });
        }
      }
    } else {
      for (const company of companyList.slice(0, 5)) {
        const r = await provider.searchByCompany({ assignee: company, limit: Math.ceil(limit / companyList.length) });
        for (const patent of r.results) {
          if (seen.has(patent.patentId)) continue;
          seen.add(patent.patentId);
          const { riskLevel, matchedTopics } = calcRiskLevel(patent, topicList);
          allResults.push({ ...patent, riskLevel, matchedTopics });
        }
      }
    }

    // 按 pbdt 倒序
    allResults.sort((a, b) => (b.pbdt ?? 0) - (a.pbdt ?? 0));

    const response = NextResponse.json({ items: allResults.slice(0, limit), _dataSource: provider.kind });
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
