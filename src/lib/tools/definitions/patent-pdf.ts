/**
 * P020 — 专利 PDF Tool
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tools/types";

export const patentPdf: ToolDefinition = {
  name: "patent_pdf",
  displayName: "PDF 全文",
  description:
    "获取专利的完整 PDF 文件。" +
    "用户想看专利全文、附图时使用。" +
    "返回签名 URL，前端 iframe 渲染。",
  inputSchema: z.object({
    pn: z.string().describe("专利公开号，如 US20240123456A1"),
  }),
  execute: async (input, provider) => {
    const i = input as { pn: string };
    const url = await provider.getPdfUrl(i.pn);
    return {
      success: true,
      data: { url },
      summary: `获取 ${i.pn} PDF URL`,
    };
  },
};
