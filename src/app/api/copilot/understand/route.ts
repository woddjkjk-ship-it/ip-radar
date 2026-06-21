/**
 * POST /api/copilot/understand — Step 1: 技术理解
 *
 * 两种调用方式：
 * 1. 新建会话：提供 text + competitors，创建会话并执行 Step 1。
 * 2. 续接会话：提供 sessionId，对已有会话执行 Step 1（用于 HITL 流程）。
 *
 * 通过 SSE 流式返回 TechElements 提取结果，前端渲染 ElementsEditor 供用户微调。
 *
 * Body: { text?, competitors?, imageRef?, sessionId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SessionStore } from "@/lib/session/store";
import { stepUnderstand } from "@/lib/agent/steps/understand";
import { createSSEStream } from "@/lib/agent/stream";

const RequestSchema = z.object({
  sessionId: z.string().optional(),
  text: z.string().optional(),
  imageRef: z.string().optional(),
  competitors: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // 必须有 sessionId，或者 text + competitors 都满足条件
    if (data.sessionId) return true;
    return (data.text?.length ?? 0) >= 10 && (data.competitors?.length ?? 0) >= 1;
  },
  { message: "需要 sessionId 或 (text ≥ 10 字 + competitors ≥ 1 个)" },
);

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

  const { sessionId, text, imageRef, competitors } = parsed.data;

  try {
    let session;

    if (sessionId) {
      // ── 续接已有会话 ──
      session = SessionStore.getSession(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    } else {
      // ── 新建会话 ──
      session = SessionStore.createSession(
        { text: text!, imageRef },
        competitors!,
      );
    }

    // 运行 Step 1
    const pipeline = stepUnderstand(session);
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
