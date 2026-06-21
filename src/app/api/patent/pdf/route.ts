/**
 * GET /api/patent/pdf — 获取专利 PDF 签名 URL
 *
 * Query: pn (公开号)
 * Live 模式：调 P020 获取签名 URL → 返回 { signedUrl }
 * Mock 模式：返回 { mockPdfPath }，前端直接读 /demo-patents/{pn}.pdf
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/providers";

const QuerySchema = z.object({
  pn: z.string().min(1),
});

/** 已知有本地 PDF 的演示专利号 */
const DEMO_PN_SET = new Set([
  "US20240123456A1",
  "CN116994312A",
  "EP4189620B1",
  "EP3865378B1",
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing pn" }, { status: 400 });
  }

  const { pn } = parsed.data;
  const { provider, source } = await getProvider();

  if (source === "live" && provider.kind === "patsnap") {
    // Live: 调 P020 获取签名 URL（getPdfUrl 已在 PatentDataProvider 接口中）
    try {
      const signedUrl = await provider.getPdfUrl(pn);
      return NextResponse.json({ signedUrl, source: "live" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Mock: 返回本地 demo-patents 路径
  if (DEMO_PN_SET.has(pn)) {
    return NextResponse.json({
      mockPdfPath: `/demo-patents/${pn}.pdf`,
      source: "mock",
    });
  }

  return NextResponse.json({
    mockPdfPath: null,
    source: "mock",
    note: "演示模式 · 切换 Live 可查看完整 PDF",
  });
}
