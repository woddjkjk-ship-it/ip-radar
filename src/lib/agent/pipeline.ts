/**
 * FTO Pipeline 编排器 — 4 步流水线
 *
 * 按顺序执行 understand → search → assess → report，
 * 每一步都是 AsyncGenerator，通过 yield* 透传 StepUpdate 事件。
 *
 * 用法（API route）：
 * ```
 * const session = SessionStore.createSession(input, competitors);
 * const pipeline = runFtoPipeline(session);
 * return new Response(createSSEStream(pipeline), {
 *   headers: { 'Content-Type': 'text/event-stream' },
 * });
 * ```
 */

import type { CopilotSession } from "@/lib/session/types";
import type { StepUpdate } from "@/lib/agent/stream";
import type { TechElements } from "@/lib/types";
import { z } from "zod";
import { TechElementsSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import { stepUnderstand } from "@/lib/agent/steps/understand";
import { stepSearch } from "@/lib/agent/steps/search";
import { stepAssess } from "@/lib/agent/steps/assess";
import { stepReport } from "@/lib/agent/steps/report";

/**
 * 执行完整的 FTO 4 步流水线。
 *
 * @param session - 已创建的 CopilotSession
 * @param confirmedElements - 可选：用户 HITL 确认/修改后的技术要素。
 *   若提供，Step 1 将跳过 LLM 提取，直接使用用户确认版本。
 */
export async function* runFtoPipeline(
  session: CopilotSession,
  confirmedElements?: z.infer<typeof TechElementsSchema>,
): AsyncGenerator<StepUpdate> {
  // Step 1: 技术理解
  yield* stepUnderstand(session, confirmedElements);

  // 检查 Step 1 是否成功
  if (session.steps[1].status === "error") {
    yield {
      sessionId: session.id,
      step: 0 as const,
      status: "error",
      name: "Pipeline 中止",
      error: "Step 1 失败，流水线终止",
    };
    return;
  }

  // Step 2: 专利检索
  yield* stepSearch(session);

  if (session.steps[2].status === "error") {
    yield {
      sessionId: session.id,
      step: 0 as const,
      status: "error",
      name: "Pipeline 中止",
      error: "Step 2 失败，流水线终止",
    };
    return;
  }

  // Step 3: 风险评估
  yield* stepAssess(session);

  if (session.steps[3].status === "error") {
    yield {
      sessionId: session.id,
      step: 0 as const,
      status: "error",
      name: "Pipeline 中止",
      error: "Step 3 失败，流水线终止",
    };
    return;
  }

  // Step 4: 报告生成
  yield* stepReport(session);
}

/**
 * 创建新会话并运行流水线的便捷函数。
 *
 * @param text - 用户输入的技术方案文本
 * @param competitors - 竞品池企业列表
 * @param imageRef - 可选：架构图 URL/base64
 */
export async function* runFtoPipelineFromInput(
  text: string,
  competitors: string[],
  imageRef?: string,
): AsyncGenerator<StepUpdate> {
  const session = SessionStore.createSession({ text, imageRef }, competitors);
  yield* runFtoPipeline(session);
}
