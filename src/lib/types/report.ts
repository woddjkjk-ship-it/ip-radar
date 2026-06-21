/**
 * FTO 报告结构化类型 — 替代原始 Markdown 输出
 *
 * Step 4（报告生成）的 LLM 输出改为结构化 JSON，
 * 前端 ReportPreview 按 sections 分块渲染。
 * Markdown 字符串仅作为兜底 fallback 保留。
 */

import { z } from "zod";

// ===== 单条专利风险项 =====

export interface PatentRiskItem {
  /** 公开/公告号 */
  pn: string;
  /** 专利标题 */
  title: string;
  /** 专利权人 */
  assignee: string;
  /** 风险等级 */
  riskLevel: "high" | "medium" | "low";
  /** 命中的权利要求编号 */
  matchedClaims: number[];
  /** 风险分析（自然语言） */
  analysis: string;
  /** 规避建议 */
  avoidanceAdvice: string;
  /** 法律状态 */
  legalStatus: "active" | "expired" | "pending" | "unknown";
}

// ===== FTO 完整报告 =====

export interface FtoReport {
  /** 报告标题 */
  title: string;
  /** 执行摘要（1-2 段概述） */
  executiveSummary: string;
  /** 整体风险等级 */
  riskLevel: "high" | "medium" | "low";
  /** 统计数据 */
  stats: {
    totalPatents: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  /** 逐条专利分析 */
  patentAnalysis: PatentRiskItem[];
  /** 规避与申请建议列表 */
  recommendations: string[];
  /** 生成时间 ISO-8601 */
  generatedAt: string;
  /** 使用模型 */
  modelUsed: string;
  /** Token 用量（若有） */
  tokenUsage?: {
    prompt: number;
    completion: number;
  };
}

// ===== Zod Schemas =====

export const PatentRiskItemSchema = z.object({
  pn: z.string(),
  title: z.string(),
  assignee: z.string(),
  riskLevel: z.enum(["high", "medium", "low"]),
  matchedClaims: z.array(z.number()),
  analysis: z.string(),
  avoidanceAdvice: z.string(),
  legalStatus: z.enum(["active", "expired", "pending", "unknown"]),
});

export const FtoReportSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  riskLevel: z.enum(["high", "medium", "low"]),
  stats: z.object({
    totalPatents: z.number(),
    highRisk: z.number(),
    mediumRisk: z.number(),
    lowRisk: z.number(),
  }),
  patentAnalysis: z.array(PatentRiskItemSchema),
  recommendations: z.array(z.string()),
  generatedAt: z.string(),
  modelUsed: z.string(),
  tokenUsage: z
    .object({
      prompt: z.number(),
      completion: z.number(),
    })
    .optional(),
});
