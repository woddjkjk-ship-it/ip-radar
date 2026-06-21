/**
 * P018 — 权利要求 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentClaims: ToolDefinition = {
  name: "patent_claims",
  displayName: "权利要求",
  description:
    "获取专利的权利要求文本。" +
    "用户想查看某件专利的具体保护范围时使用。" +
    "独立权利要求和从属权利要求分别标注。",
  inputSchema: z.object({
    patent_id: z.string().describe("智慧芽内部 patentId（UUID）"),
  }),
  execute: async (input, provider) => {
    const i = input as { patent_id: string };
    const claims = await provider.getClaims(i.patent_id);
    return {
      success: true,
      data: claims,
      summary: `获取 ${claims.length} 条权利要求`,
    };
  },
};
