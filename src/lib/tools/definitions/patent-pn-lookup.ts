/**
 * 专利号检索 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentPnLookup: ToolDefinition = {
  name: "patent_pn_lookup",
  displayName: "专利号查询",
  description:
    "按专利号（公开号/公告号）查询专利。" +
    "用户提供了具体专利号（CN/US/EP/WO/JP/KR 开头 + 数字）时使用。" +
    "支持批量查询，逗号或空格分隔。",
  inputSchema: z.object({
    pns: z.array(z.string()).describe("专利号列表"),
  }),
  execute: async (input, provider) => {
    const i = input as { pns: string[] };
    const result = await provider.searchByPn(i.pns);
    return {
      success: true,
      data: result,
      summary: `查询 ${i.pns.length} 个专利号，返回 ${result.results.length} 条`,
    };
  },
};
