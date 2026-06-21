/**
 * DeepSeek V4 Pro 客户端 — 走 Anthropic Messages API 兼容端点
 *
 * 为什么用 fetch 而非 SDK：DeepSeek 的 /anthropic 端点是 Anthropic 协议，
 * 不是 OpenAI 协议。直接用 fetch 避免引入 @anthropic-ai/sdk 依赖。
 *
 * 端点基址：https://api.deepseek.com/anthropic（来自 DEEPSEEK_API_BASE 环境变量）
 * 模型：deepseek-v4-pro
 */

import type { ChatLLM, ChatMessage, ChatOptions, ChatResult } from "@/lib/llm/types";

/** 默认模型 */
const DEFAULT_MODEL = "deepseek-v4-pro";

/** Anthropic Messages API 请求格式 */
interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
}

/** Anthropic Messages API 响应格式 */
interface AnthropicResponse {
  id: string;
  model: string;
  content: { type: "text"; text: string }[];
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * 将 ChatMessage[] 转为 Anthropic 格式。
 * system 角色的消息提升为顶层 system 字段；
 * user/assistant 角色保留在 messages 数组中。
 */
function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
} {
  let system: string | undefined;
  const converted: { role: "user" | "assistant"; content: string }[] = [];

  for (const msg of messages) {
    // 处理 content：可能是 string 或 ChatContentPart[]
    const content = typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n");

    if (msg.role === "system") {
      system = (system ? system + "\n" : "") + content;
    } else if (msg.role === "user" || msg.role === "assistant") {
      converted.push({ role: msg.role, content });
    }
  }

  return { system, messages: converted };
}

export class DeepSeekChatLLM implements ChatLLM {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? "https://api.deepseek.com/anthropic";
    this.model = model ?? DEFAULT_MODEL;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const t0 = Date.now();
    const model = options?.model ?? this.model;

    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    const body: AnthropicRequest = {
      model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: anthropicMessages,
    };

    if (system) body.system = system;
    if (options?.temperature !== undefined) body.temperature = options.temperature;

    // 如果要求 JSON 输出，在 system prompt 末尾追加指令
    if (options?.responseFormat === "json_object") {
      body.system = (body.system ?? "") + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation.";
    }

    const url = `${this.baseUrl}/v1/messages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[DeepSeek] HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as AnthropicResponse;

    // 拼接所有 text content blocks
    const content = json.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    return {
      content,
      usage: json.usage
        ? { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens }
        : undefined,
      model: json.model,
      latencyMs: Date.now() - t0,
    };
  }
}
