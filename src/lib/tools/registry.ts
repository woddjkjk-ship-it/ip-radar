/**
 * Tool 注册表 — 全局注册所有可用的 MCP Tool
 *
 * Tool 层职责：原子 API 包装。
 * 每个页面 AI 助手的 Skill 从此注册表中选取需要的 Tool 子集。
 */

import type { ToolDefinition } from "@/lib/tools/types";
import { patentKeywordSearch } from "@/lib/tools/definitions/patent-keyword-search";
import { patentSemanticSearch } from "@/lib/tools/definitions/patent-semantic-search";
import { patentCompanySearch } from "@/lib/tools/definitions/patent-company-search";
import { patentPnLookup } from "@/lib/tools/definitions/patent-pn-lookup";
import { patentDetail } from "@/lib/tools/definitions/patent-detail";
import { patentClaims } from "@/lib/tools/definitions/patent-claims";
import { patentPdf } from "@/lib/tools/definitions/patent-pdf";
import { patentLegalStatus } from "@/lib/tools/definitions/patent-legal-status";
import { analyticsTrend } from "@/lib/tools/definitions/analytics-trend";
import { analyticsApplicant } from "@/lib/tools/definitions/analytics-applicant";

/** 全部已注册 Tool */
export const ALL_TOOLS: ToolDefinition[] = [
  patentKeywordSearch,
  patentSemanticSearch,
  patentCompanySearch,
  patentPnLookup,
  patentDetail,
  patentClaims,
  patentPdf,
  patentLegalStatus,
  analyticsTrend,
  analyticsApplicant,
];

/** 按名称查找 Tool */
const toolMap = new Map<string, ToolDefinition>();
ALL_TOOLS.forEach((t) => toolMap.set(t.name, t));

export function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

export { patentKeywordSearch, patentSemanticSearch, patentCompanySearch, patentPnLookup };
export { patentDetail, patentClaims, patentPdf, patentLegalStatus };
export { analyticsTrend, analyticsApplicant };
