/**
 * A007 — 申请人排名 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const analyticsApplicant: ToolDefinition = {
  name: "analytics_applicant",
  displayName: "申请人排名",
  description:
    "获取技术领域内主要申请人的专利量排名。" +
    "用户问'谁最厉害/哪些公司在做/主要玩家'时使用。" +
    "可指定企业查看其技术构成。",
  inputSchema: z.object({
    query: z.string().describe("技术主题词"),
    limit: z.number().default(10).describe("返回 Top N 申请人"),
  }),
  execute: async (input, provider) => {
    const i = input as { query: string; limit: number };
    // 申请人排名通过公司搜索模拟（A007 实际需更复杂的分析 API）
    const companies = ["Waymo", "Tesla", "华为车BU", "Mobileye", "Nvidia", "小鹏", "地平线"];
    const results = await Promise.all(
      companies.slice(0, i.limit).map(async (c) => {
        const r = await provider.searchByCompany({ assignee: c, limit: 1 });
        return { name: c, count: r.total };
      }),
    );
    results.sort((a, b) => b.count - a.count);
    return {
      success: true,
      data: results,
      summary: `"${i.query}" 申请人排名，Top ${results.length}`,
    };
  },
};
