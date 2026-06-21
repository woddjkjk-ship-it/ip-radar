/**
 * Qwen-VL-Max 客户端 — 模态桥接，走 OpenAI 兼容协议
 *
 * 为什么用 OpenAI SDK：阿里灵积 DashScope 提供 OpenAI 兼容端点，
 * openai SDK 已在 package.json 中安装，直接复用。
 *
 * 端点基址：https://dashscope.aliyuncs.com/compatible-mode/v1
 * 模型：qwen-vl-max
 *
 * Qwen-VL 将架构图/流程图转为文字描述，再交给 DeepSeek 做主推理。
 *
 * 用户需在 .env.local 中配置 DASHSCOPE_API_KEY 后才能调用。
 */

import OpenAI from "openai";
import type { VisionLLM, VisionOptions, VisionResult } from "@/lib/llm/types";

/** 默认模型 */
const DEFAULT_MODEL = "qwen-vl-max";

/** 技术架构图描述的 system prompt */
const TECHNICAL_ARCHITECTURE_PROMPT = `You are a technical diagram analyst. Describe this architecture/flowchart diagram in detail.
Focus on:
1. The overall structure and main components
2. Data flow between components (inputs/outputs)
3. Key interfaces and APIs shown
4. The technology stack visible (frameworks, databases, protocols)
5. Any notable patterns (microservices, pipeline, event-driven, etc.)

Provide a structured description that a downstream LLM can use to understand the system design.`;

/** 通用图片描述的 system prompt */
const GENERAL_PROMPT = `Describe this image in detail. Focus on the key elements, their relationships, and any text or labels visible.`;

export class QwenVLVisionLLM implements VisionLLM {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
    this.model = model ?? DEFAULT_MODEL;
  }

  async describe(
    image: { base64: string; mimeType: string } | { url: string },
    options?: VisionOptions,
  ): Promise<VisionResult> {
    const t0 = Date.now();
    const model = options?.model ?? this.model;

    // 构建 image_url
    const imageUrl =
      "base64" in image
        ? `data:${image.mimeType};base64,${image.base64}`
        : image.url;

    // 选择 system prompt
    const systemPrompt =
      options?.style === "technical-architecture"
        ? TECHNICAL_ARCHITECTURE_PROMPT
        : GENERAL_PROMPT;

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: options?.maxTokens ?? 2000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
            {
              type: "text",
              text: "Please describe this image.",
            },
          ],
        },
      ],
    });

    const description = response.choices[0]?.message?.content ?? "";

    return {
      description,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
          }
        : undefined,
      model: response.model,
      latencyMs: Date.now() - t0,
    };
  }
}
