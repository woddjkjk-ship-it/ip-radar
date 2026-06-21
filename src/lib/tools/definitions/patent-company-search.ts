/**
 * P004 — 企业专利检索 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentCompanySearch: ToolDefinition = {
  name: "patent_company_search",
  displayName: "企业检索",
  description:
    "按企业/专利权人搜索专利。" +
    "用户提到具体公司名（Tesla/Waymo/华为/小鹏/地平线 等）时使用。" +
    "公司名会被归一化（如 '华为汽车' → '华为技术有限公司'）。",
  inputSchema: z.object({
    company: z.string().describe("企业名称"),
    keyword: z.string().optional().describe("可选：技术关键词（用于检索式构建）"),
    limit: z.number().default(20),
  }),
  execute: async (input, provider) => {
    const i = input as { company: string; keyword?: string; limit: number };
    const result = await provider.searchByCompany({
      assignee: i.company,
      limit: i.limit,
    });
    return {
      success: true,
      data: result,
      summary: `${i.company} 相关专利 ${result.total} 件，返回 ${result.results.length} 条`,
    };
  },
};
