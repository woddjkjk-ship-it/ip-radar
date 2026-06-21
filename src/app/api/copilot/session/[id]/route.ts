/**
 * GET /api/copilot/session/[id] — 获取会话完整状态
 *
 * 前端刷新页面时恢复会话状态（所有 4 步的进度和数据）。
 * 用于 StepDetailDrawer 渲染完整日志。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionStore } from "@/lib/session/store";

const ParamsSchema = z.object({
  id: z.string().min(1, "session id 不能为空"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const parsed = ParamsSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = SessionStore.getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
