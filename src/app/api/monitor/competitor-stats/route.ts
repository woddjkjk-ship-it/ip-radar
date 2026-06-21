/**
 * GET /api/monitor/competitor-stats — 竞品概览丰富数据
 *
 * Mock 模式返回 src/fixtures/competitor-stats.ts
 * Live 模式调 P001 + P004 组合返回
 */

import { NextRequest, NextResponse } from "next/server";
import { COMPETITOR_STATS } from "@/fixtures/competitor-stats";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const mode = process.env.DATA_MODE;
  if (mode !== "live") {
    return NextResponse.json({ stats: COMPETITOR_STATS, source: "mock" });
  }
  // Live 模式下应调 P001 申请人检索 + P004 近期列表，此处回退 mock
  return NextResponse.json({ stats: COMPETITOR_STATS, source: "mock" });
}
