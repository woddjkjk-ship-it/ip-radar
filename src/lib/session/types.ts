/**
 * 会话存储类型 — 全流程可追溯的核心数据结构
 *
 * 每个 FTO Copilot 会话持有 4 个 Step 的完整记录，
 * 包括 LLM 调用日志、外部 API 调用日志、HITL 修改记录。
 *
 * StepDetailDrawer 依赖此结构渲染可审计的详情面板。
 */

import type { TechElements, RiskAssessment } from "@/lib/types";

// ===== FTO 步骤编号 =====

/** 0 = 流水线级别事件（如中止），1-4 = 业务步骤 */
export type FtoStep = 0 | 1 | 2 | 3 | 4;

// ===== 步骤状态 =====

export type StepStatus = "pending" | "running" | "success" | "error";

// ===== LLM 调用日志 =====

export interface LlmCallLog {
  /** 模型名，如 "deepseek-v4-pro" / "qwen-vl-max" */
  model: string;
  /** 提供商标识 */
  provider: "deepseek" | "qwen-vl";
  /** 调用角色：chat = 主推理，vision = 模态桥接 */
  role: "chat" | "vision";
  /** 发送给 LLM 的完整 messages 数组 */
  promptMessages: { role: string; content: unknown }[];
  /** LLM 原始响应文本 */
  rawResponse: string;
  /** zod 解析后的结构化输出（解析成功时） */
  parsedOutput?: unknown;
  /** token 用量 */
  usage?: { promptTokens: number; completionTokens: number };
  /** 调用耗时（毫秒） */
  latencyMs: number;
  /** 错误信息（调用失败时） */
  error?: string;
}

// ===== 外部 API 调用日志 =====

export interface ApiCallLog {
  /** 提供商标识 */
  provider: "patsnap" | "mock";
  /** API 端点标识，如 "P002" / "P008" */
  endpoint: string;
  /** 请求体（脱敏后） */
  request: unknown;
  /** 响应体 */
  response: unknown;
  /** 调用耗时（毫秒） */
  latencyMs: number;
  /** Live 模式失败回退 Mock 时为 true */
  fallbackTriggered?: boolean;
  /** 错误信息 */
  error?: string;
}

// ===== 单步记录 =====

export interface StepRecord {
  /** 步骤编号 1-4 */
  step: FtoStep;
  /** 步骤名称 */
  name: string;
  /** 当前状态 */
  status: StepStatus;
  /** 开始时间 ISO-8601 */
  startedAt?: string;
  /** 结束时间 ISO-8601 */
  finishedAt?: string;
  /** 该步输入快照 */
  input: unknown;
  /** 该步输出（结构化） */
  output: unknown;
  /** LLM 调用日志列表 */
  llmCalls: LlmCallLog[];
  /** 外部 API 调用日志列表 */
  apiCalls: ApiCallLog[];
  /** 备注（如 HITL 修改记录） */
  notes?: string[];
  /** 错误信息列表 */
  errors?: string[];
}

// ===== 完整会话 =====

export interface CopilotSession {
  /** 会话 ID（UUID） */
  id: string;
  /** 创建时间 ISO-8601 */
  createdAt: string;
  /** 用户原始输入 */
  userInput: {
    text: string;
    /** 可选：架构图文件引用 */
    imageRef?: string;
  };
  /** 4 步记录（key 为步骤编号） */
  steps: Record<number, StepRecord>;
  /** 竞品池（配置级别） */
  competitors: string[];
  /** 最终报告 Markdown（Step 4 输出） */
  reportContent?: string;
}

// ===== Step 1 输入/输出类型 =====

export interface UnderstandInput {
  text: string;
  imageRef?: string;
  competitors: string[];
}

export interface UnderstandOutput {
  elements: TechElements;
  modified: boolean;
}

// ===== Step 2 输入/输出类型 =====

export interface SearchInput {
  elements: TechElements;
}

export interface SearchOutput {
  /** 去重融合后的 Top 专利 */
  topPatents: (import("@/lib/types").PatentSummary & { relevancyReason?: string })[];
  /** 原始三路搜索结果（用于 StepDetailDrawer 展示） */
  rawResults: {
    keyword?: { total: number; results: import("@/lib/types").PatentSummary[] };
    semantic?: { total: number; results: import("@/lib/types").PatentSummary[] };
    companies?: Record<string, { total: number; results: import("@/lib/types").PatentSummary[] }>;
  };
}

// ===== Step 3 输入/输出类型 =====

export interface AssessInput {
  topPatents: SearchOutput["topPatents"];
  elements: TechElements;
}

export interface AssessOutput {
  assessments: RiskAssessment[];
}

// ===== Step 4 输入/输出类型 =====

export interface ReportInput {
  elements: TechElements;
  topPatents: SearchOutput["topPatents"];
  assessments: RiskAssessment[];
}

export interface ReportOutput {
  /** Markdown 格式报告全文 */
  markdown: string;
  /** 报告标题 */
  title: string;
}
