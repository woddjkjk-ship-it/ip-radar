/**
 * POST /api/copilot/run — 运行 FTO 流水线（支持 HITL 恢复）
 *
 * 两种模式：
 * 1. 全新运行：提供 text + competitors，创建新会话并跑 4 步
 * 2. HITL 恢复：提供 sessionId + confirmedElements，从 Step 2 继续
 *
 * Body: { text?, competitors?, sessionId?, confirmedElements?, imageRef? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TechElementsSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import { runFtoPipeline } from "@/lib/agent/pipeline";
import { createSSEStream } from "@/lib/agent/stream";

const RequestSchema = z.object({
  // 全新运行
  text: z.string().min(10).optional(),
  imageRef: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  // HITL 恢复
  sessionId: z.string().optional(),
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

  const { text, imageRef, competitors, sessionId, confirmedElements } = parsed.data;

  try {
    // ── HITL 恢复模式 ──
    if (sessionId && confirmedElements) {
      const session = SessionStore.getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // 从 Step 2 继续（confirmedElements 会让 Step 1 跳过 LLM）
      const pipeline = runFtoPipeline(session, confirmedElements);
      const stream = createSSEStream(pipeline);

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Session-Id": session.id,
        },
      });
    }

    // ── 全新运行模式 ──
    if (!text || !competitors) {
      return NextResponse.json(
        { error: "全新运行需要 text + competitors" },
        { status: 400 },
      );
    }

    const session = SessionStore.createSession({ text, imageRef }, competitors);
    const pipeline = runFtoPipeline(session);
    const stream = createSSEStream(pipeline);

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
