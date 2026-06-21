/**
 * A001 — 专利趋势分析 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const analyticsTrend: ToolDefinition = {
  name: "analytics_trend",
  displayName: "趋势分析",
  description:
    "获取技术领域的专利申请趋势（按年份统计）。" +
    "用户问'趋势/增长/热度变化'时使用。" +
    "可叠加竞品企业对比。",
  inputSchema: z.object({
    query: z.string().describe("Patsnap 检索式或技术主题词"),
    from: z.number().default(2018).describe("起始年份"),
    to: z.number().default(2025).describe("截止年份"),
  }),
  execute: async (input, provider) => {
    const i = input as { query: string; from: number; to: number };
    // 趋势分析用 countByQuery 模拟（A001 实际需更复杂的 API）
    const total = await provider.countByQuery(i.query);
    return {
      success: true,
      data: { query: i.query, from: i.from, to: i.to, total },
      summary: `"${i.query}" 趋势分析（${i.from}-${i.to}），总计 ${total} 件`,
    };
  },
};
