/**
 * GET /api/search/detail — 专利详情
 *
 * Query params:
 *   patentId: string  — 智慧芽专利 UUID
 *   pn: string        — 公开号（如 CN117423077A），自动解析为 patentId 后查详情
 * 并行调用 P012（著录项目） + P018（权利要求） + P041（法律状态）
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/providers";

const QuerySchema = z.object({
  patentId: z.string().optional(),
  pn: z.string().optional(),
}).refine(
  (data) => data.patentId || data.pn,
  { message: "需要 patentId 或 pn 参数" },
);

/** 根据 PN 解析 patent_id（UUID） */
async function resolvePatentId(pn: string): Promise<string> {
  const { provider } = await getProvider();
  const result = await provider.searchByPn([pn], 1);
  if (result.results.length === 0) {
    throw new Error(`未找到专利号 ${pn} 对应的专利`);
  }
  return result.results[0].patentId;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "需要 patentId 或 pn 参数", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { patentId: inputPatentId, pn } = parsed.data;
  const { provider, fallbackTriggered, fallbackReason } = await getProvider();

  try {
    // 如果传了 pn，先解析为 patent_id
    const patentId = inputPatentId ?? await resolvePatentId(pn!);
    const detail = await provider.getDetail(patentId);
    const response = NextResponse.json({
      patent: detail,
      _dataSource: provider.kind,
      _endpoint: "P012/P018/P041",
    });
    response.headers.set("X-Data-Source", provider.kind);
    if (fallbackTriggered) {
      response.headers.set("X-Fallback-Reason", fallbackReason ?? "unknown");
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
