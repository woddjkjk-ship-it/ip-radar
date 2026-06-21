/**
 * POST /api/copilot/start — 启动 FTO 流水线（后台执行）
 *
 * 流水线在服务端后台运行，不受客户端导航影响。
 * 客户端通过 GET /api/copilot/session/[id] 轮询获取最新状态。
 *
 * 两种模式：
 * 1. 全新运行：提供 text + competitors
 * 2. HITL 恢复：提供 sessionId + confirmedElements，从 Step 2 继续
 *
 * Body: { text?, competitors?, sessionId?, confirmedElements?, imageRef? }
 * Returns: { sessionId }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TechElementsSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import { runFtoPipeline } from "@/lib/agent/pipeline";
import { stepUnderstand } from "@/lib/agent/steps/understand";
import type { StepUpdate } from "@/lib/agent/stream";

/** 消费 AsyncGenerator 直到结束（后台执行，不阻塞响应） */
async function consumeGenerator(gen: AsyncGenerator<StepUpdate>): Promise<void> {
  for await (const _event of gen) {
    // 事件已通过 step 函数写入 SessionStore，此处只需消费
  }
}

const RequestSchema = z.object({
  // 全新运行
  text: z.string().min(10).optional(),
  imageRef: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  // HITL 恢复
  sessionId: z.string().optional(),
  confirmedElements: TechElementsSchema.optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
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

      // 后台执行 Step 2-4，不阻塞响应
      consumeGenerator(runFtoPipeline(session, confirmedElements)).catch(
        (err) => console.error("[copilot/start] HITL resume error:", err),
      );

      return NextResponse.json({ sessionId: session.id });
    }

    // ── 全新运行模式：只执行 Step 1（技术理解），完成后前端 HITL 等待用户确认 ──
    if (!text || !competitors) {
      return NextResponse.json(
        { error: "全新运行需要 text + competitors" },
        { status: 400 },
      );
    }

    const session = SessionStore.createSession({ text, imageRef }, competitors);

    // 后台仅执行 Step 1，不继续执行 Steps 2-4
    // 用户确认 HITL 后，前端以 sessionId + confirmedElements 再次调用本接口触发 Steps 2-4
    consumeGenerator(stepUnderstand(session)).catch(
      (err) => console.error("[copilot/start] Step 1 error:", err),
    );

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Pipeline initialization failed", detail: message },
      { status: 500 },
    );
  }
}
