/**
 * LLM 抽象接口 — 隔离 LLM 提供商
 *
 * ChatLLM：主推理（DeepSeek V4 Pro）
 * VisionLLM：模态桥接（Qwen-VL-Max）
 *
 * 都走 OpenAI 兼容 chat completion 协议（DeepSeek 走 /anthropic 端点）。
 */

// ===== 消息类型（OpenAI 兼容） =====

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

export interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string; // base64 data URI 或 http URL
    detail?: "auto" | "low" | "high";
  };
}

// ===== 调用选项 =====

export interface ChatOptions {
  /** 模型名，如 deepseek-v4-pro */
  model?: string;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 温度 */
  temperature?: number;
  /** 响应格式（json_object / text） */
  responseFormat?: "text" | "json_object";
}

export interface VisionOptions {
  model?: string;
  maxTokens?: number;
  /** 描述风格提示 */
  style?: "technical-architecture" | "general";
}

// ===== 调用结果 =====

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  model: string;
  latencyMs: number;
}

export interface VisionResult {
  description: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  model: string;
  latencyMs: number;
}

// ===== LLM 接口 =====

export interface ChatLLM {
  /** 发送 chat completion 请求 */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}

export interface VisionLLM {
  /** 图片理解 → 文字描述 */
  describe(
    image: { base64: string; mimeType: string } | { url: string },
    options?: VisionOptions
  ): Promise<VisionResult>;
}
