/**
 * GET /api/search/suggest — P070 关键词建议
 *
 * 调用智慧芽 P070 关键词助手，返回建议检索式列表。
 * Mock 模式或 P070 不可用时返回空数组。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  // P070 关键词助手暂未集成到 Provider 接口，统一返回空数组。
  // Live 模式需扩展 PatentDataProvider 后启用。
  return NextResponse.json({ suggestions: [] });
}
