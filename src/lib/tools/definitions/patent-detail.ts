/**
 * P012 — 专利详情 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentDetail: ToolDefinition = {
  name: "patent_detail",
  displayName: "专利详情",
  description:
    "获取专利的详细信息，包括摘要、权利要求、法律状态、IPC 分类。" +
    "用户想了解某件专利的完整信息时使用。" +
    "通常跟在 search 之后，对检索结果中的专利逐一获取详情。",
  inputSchema: z.object({
    patent_id: z.string().describe("智慧芽内部 patentId（UUID）"),
  }),
  execute: async (input, provider) => {
    const i = input as { patent_id: string };
    const detail = await provider.getDetail(i.patent_id);
    return {
      success: true,
      data: detail,
      summary: `获取专利 ${detail.pn} 详情（${detail.claims.length} 条权利要求）`,
    };
  },
};
