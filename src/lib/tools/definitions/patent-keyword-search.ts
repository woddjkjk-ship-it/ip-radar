/**
 * P002 — 关键词检索 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentKeywordSearch: ToolDefinition = {
  name: "patent_keyword_search",
  displayName: "关键词检索",
  description:
    "根据 Patsnap 检索式搜索专利。" +
    "用户提到技术关键词、IPC、申请日范围时使用。" +
    "检索式语法：TACD:(关键词) AND APD:[起始 TO 截止] AND PA:申请人",
  inputSchema: z.object({
    query_text: z.string().describe("Patsnap 检索式"),
    limit: z.number().default(20),
    sort_field: z.enum(["SCORE", "PBDT", "APD"]).default("SCORE"),
  }),
  execute: async (input, provider) => {
    const i = input as { query_text: string; limit: number };
    const result = await provider.searchByKeyword({
      queryText: i.query_text,
      limit: i.limit,
    });
    return {
      success: true,
      data: result,
      summary: `命中 ${result.total} 件，返回前 ${result.results.length} 条`,
    };
  },
};
