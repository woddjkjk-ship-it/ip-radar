/**
 * POST /api/copilot/report — Step 4: 报告生成
 *
 * 汇总前三步输出，生成 Markdown 格式 FTO 初审报告。
 * 通过 SSE 流式返回报告内容。
 *
 * Body: { sessionId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionStore } from "@/lib/session/store";
import { stepReport } from "@/lib/agent/steps/report";
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

    const stream = createSSEStream(stepReport(session));

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
