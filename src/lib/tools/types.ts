/**
 * MCP Tool 层 — 类型定义
 *
 * Tool = name + description + inputSchema + execute（MCP 兼容格式）
 * Skill = systemPrompt + Tool 子集 + 编排逻辑 + 日志
 */

import type { z } from "zod";
import type { PatentDataProvider } from "@/lib/providers/types";

// ===== Tool 定义 =====

export interface ToolDefinition {
  /** 唯一标识，如 "patent_keyword_search"（MCP tool name） */
  name: string;
  /** 展示名，如 "关键词检索"（UI 显示用） */
  displayName: string;
  /** 供 DeepSeek 理解 tool 用途的详细描述（MCP description） */
  description: string;
  /** 入参 schema（MCP inputSchema，Zod 格式） */
  inputSchema: z.ZodSchema;
  /** 执行函数 */
  execute: (input: unknown, provider: PatentDataProvider) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  /** 供日志和 UI 展示的结果摘要 */
  summary: string;
}

// ===== Skill 定义 =====

export interface SkillDefinition {
  /** 唯一标识，如 "smart_patent_search" */
  name: string;
  /** UI 展示名，如 "AI 智能检索" */
  displayName: string;
  /** 功能描述 */
  description: string;
  /** 领域专属 system prompt，注入 DeepSeek */
  systemPrompt: string;
  /** 此 Skill 可调用的 Tool 子集 */
  tools: ToolDefinition[];
}

export interface SkillInput {
  /** 用户自然语言输入 */
  userInput: string;
  /** 数据源（Mock 或 Live） */
  provider: PatentDataProvider;
}

export interface SkillResult {
  success: boolean;
  /** 前端应执行的 UI 动作 */
  action: SkillAction;
  /** 降级时的原始输入 */
  fallbackInput?: string;
}

export interface SkillAction {
  type: "fill_and_search" | "fill_form" | "show_results";
  /** 选中的 Tab（如 'keyword' | 'semantic' | 'company' | 'pn'） */
  tab?: string;
  /** 填入 UI 的参数 */
  params: Record<string, unknown>;
  /** 是否自动触发提交 */
  autoSubmit?: boolean;
}

// ===== Router 类型 =====

export interface ToolCall {
  /** Tool name */
  name: string;
  displayName: string;
  /** 解析后的参数 */
  arguments: Record<string, unknown>;
}

export interface RouterResult {
  toolCalls: ToolCall[];
  /** 路由日志（供 ActivityLog 使用） */
  rawRequest?: unknown;
  rawResponse?: unknown;
}
