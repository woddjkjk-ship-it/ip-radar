/**
 * P008 — 语义检索 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentSemanticSearch: ToolDefinition = {
  name: "patent_semantic_search",
  displayName: "语义检索",
  description:
    "用自然语言描述技术方案，通过语义相似度搜索相关专利。" +
    "用户输入较长技术描述（>30 字）、想找概念相近的专利时使用。" +
    "不适合精确关键词或专利号查询。",
  inputSchema: z.object({
    text: z.string().describe("技术描述文本，建议 50-500 字"),
    limit: z.number().default(15),
  }),
  execute: async (input, provider) => {
    const i = input as { text: string; limit: number };
    const result = await provider.searchBySemantic({
      queryText: i.text,
      limit: i.limit,
    });
    return {
      success: true,
      data: result,
      summary: `语义检索命中 ${result.total} 件，返回前 ${result.results.length} 条`,
    };
  },
};
