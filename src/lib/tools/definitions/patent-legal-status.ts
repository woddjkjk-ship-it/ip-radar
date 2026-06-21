/**
 * P041 — 法律状态 Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentLegalStatus: ToolDefinition = {
  name: "patent_legal_status",
  displayName: "法律状态",
  description:
    "查询专利当前的法律状态（有效/失效/审中/未知）。" +
    "用户关心某件专利是否还有效、是否可以自由实施时使用。",
  inputSchema: z.object({
    patent_id: z.string().describe("智慧芽内部 patentId（UUID）"),
  }),
  execute: async (input, provider) => {
    const i = input as { patent_id: string };
    const status = await provider.getLegalStatus(i.patent_id);
    return {
      success: true,
      data: { status },
      summary: `法律状态：${status}`,
    };
  },
};
