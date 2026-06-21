/**
 * SSE 流式工具 — 用于 API routes 将 Pipeline 输出推送到前端
 *
 * StepUpdate 是 Pipeline 每一步 yield 的事件类型，
 * 前端 eventsource-parser 解析后更新 UI 状态。
 */

import type { FtoStep, StepStatus, StepRecord } from "@/lib/session/types";

/** Pipeline 每一步 yield 的事件 */
export interface StepUpdate {
  sessionId: string;
  step: FtoStep;
  status: StepStatus;
  /** 步骤名称 */
  name: string;
  /** 该步输出（streaming 时可能为部分数据） */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 完整的 StepRecord（step 完成后发送，供 StepDetailDrawer 使用） */
  stepRecord?: StepRecord;
  /** 最终报告内容（仅 step 4 success 时携带） */
  reportContent?: string;
}

/** SSE 事件名称 */
const EVENT_NAME = "step-update";

/**
 * 将 StepUpdate 写入 SSE 响应流。
 *
 * 使用示例（API route）:
 * ```
 * const encoder = new TextEncoder();
 * const stream = new ReadableStream({
 *   start(controller) {
 *     for await (const update of runFtoPipeline(...)) {
 *       sendSSE(controller, encoder, update);
 *     }
 *     controller.close();
 *   }
 * });
 * return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
 * ```
 */
export function sendSSE(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  update: StepUpdate,
): void {
  const data = `event: ${EVENT_NAME}\ndata: ${JSON.stringify(update)}\n\n`;
  controller.enqueue(encoder.encode(data));
}

/**
 * 创建 SSE ReadableStream 的辅助函数。
 *
 * @param pipeline - AsyncGenerator<StepUpdate>
 * @returns ReadableStream<Uint8Array>
 */
export function createSSEStream(
  pipeline: AsyncGenerator<StepUpdate>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const update of pipeline) {
          sendSSE(controller, encoder, update);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        const errorUpdate: StepUpdate = {
          sessionId: "",
          step: 1 as FtoStep,
          status: "error",
          name: "Pipeline Error",
          error,
        };
        sendSSE(controller, encoder, errorUpdate);
      } finally {
        controller.close();
      }
    },
  });
}
