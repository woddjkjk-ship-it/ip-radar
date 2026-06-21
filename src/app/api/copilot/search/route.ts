/**
 * POST /api/copilot/search — Step 2: 专利检索
 *
 * 基于 Step 1 提取的技术要素，执行并行三路搜索 + LLM 去重融合。
 * 通过 SSE 流式返回检索进度和结果。
 *
 * Body: { sessionId: string, confirmedElements?: TechElements }
 *   若提供 confirmedElements，先更新 Step 1 输出（HITL 回调），再执行检索。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TechElementsSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import { stepUnderstand } from "@/lib/agent/steps/understand";
import { stepSearch } from "@/lib/agent/steps/search";
import { createSSEStream } from "@/lib/agent/stream";

const RequestSchema = z.object({
  sessionId: z.string().min(1),
  confirmedElements: TechElementsSchema.optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, confirmedElements } = parsed.data;

  try {
    const existingSession = SessionStore.getSession(sessionId);
    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = existingSession;

    // 如果用户提供了确认/修改后的要素，先更新 Step 1（HITL）
    async function* pipeline() {
      if (confirmedElements) {
        yield* stepUnderstand(session, confirmedElements);
      }
      yield* stepSearch(session);
    }

    const stream = createSSEStream(pipeline());

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Session-Id": session.id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pipeline initialization failed", detail: message },
      { status: 500 },
    );
  }
}
