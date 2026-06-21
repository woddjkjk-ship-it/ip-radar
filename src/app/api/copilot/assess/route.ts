/**
 * POST /api/copilot/assess — Step 3: 风险评估
 *
 * 基于 Step 2 的 Top 专利列表，获取详情并进行逐条风险评估。
 * 通过 SSE 流式返回评估结果。
 *
 * Body: { sessionId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionStore } from "@/lib/session/store";
import { stepAssess } from "@/lib/agent/steps/assess";
import { createSSEStream } from "@/lib/agent/stream";

const RequestSchema = z.object({
  sessionId: z.string().min(1),
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

  const { sessionId } = parsed.data;

  try {
    const session = SessionStore.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const stream = createSSEStream(stepAssess(session));

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
