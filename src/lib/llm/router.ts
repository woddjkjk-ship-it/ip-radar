/**
 * LLM 路由工厂 — 根据环境变量创建 ChatLLM / VisionLLM 实例
 *
 * ChatLLM 目前只有 DeepSeek；VisionLLM 目前只有 Qwen-VL。
 * 工厂模式使未来切换提供商只需改环境变量，不触碰调用方代码。
 *
 * 降级策略：
 * - ChatLLM：若 DEEPSEEK_API_KEY 缺失 → throw（Mock 模式下不调 LLM，由 Agent 层处理）
 * - VisionLLM：若 DASHSCOPE_API_KEY 缺失 → throw（调用方记录并降级）
 */

import { DeepSeekChatLLM } from "./deepseek";
import { QwenVLVisionLLM } from "./qwen-vl";
import type { ChatLLM, VisionLLM } from "./types";

export type { ChatLLM, VisionLLM, ChatMessage, ChatOptions, ChatResult, VisionOptions, VisionResult } from "./types";
export { DeepSeekChatLLM } from "./deepseek";
export { QwenVLVisionLLM } from "./qwen-vl";

/**
 * 获取 ChatLLM 实例（当前仅 DeepSeek）。
 *
 * 读取 DEEPSEEK_API_KEY / DEEPSEEK_API_BASE / DEEPSEEK_MODEL 环境变量。
 * 若 key 缺失则抛出异常 — Mock 模式下的 Agent 层应自行兜底。
 */
export function getChatLLM(): ChatLLM {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error(
      "[llm] DEEPSEEK_API_KEY not set. In mock mode, Agent layer should catch this and use mock LLM responses."
    );
  }
  return new DeepSeekChatLLM(
    key,
    process.env.DEEPSEEK_API_BASE,
    process.env.DEEPSEEK_MODEL,
  );
}

/**
 * 获取 VisionLLM 实例（当前仅 Qwen-VL）。
 *
 * 读取 DASHSCOPE_API_KEY / DASHSCOPE_API_BASE / QWEN_VL_MODEL 环境变量。
 *
 * 若 key 缺失则抛出异常 — 调用方应记录原因并跳过图像理解。
 */
export function getVisionLLM(): VisionLLM {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    throw new Error("[llm] DASHSCOPE_API_KEY not set. Vision analysis requires DashScope configuration.");
  }
  return new QwenVLVisionLLM(
    key,
    process.env.DASHSCOPE_API_BASE,
    process.env.QWEN_VL_MODEL,
  );
}
