/**
 * FTO 风险评估相关类型
 *
 * 用于 Step 3（评估）的输出：逐条专利的风险等级 + 命中权利要求 + 规避建议。
 */

import { z } from "zod";

/** 风险等级 */
export type RiskLevel = "high" | "medium" | "low";

/** 单条专利的风险评估 */
export interface RiskAssessment {
  patentId: string;
  pn: string;
  title: string;
  riskLevel: RiskLevel;
  /** 命中的权利要求编号 */
  matchedClaims: number[];
  /** 风险分析（LLM 输出的自然语言解释） */
  analysis: string;
  /** 规避建议 */
  avoidanceAdvice: string;
  /** 命中的权利要求条号（用于展示原文摘录） */
  claimRef?: number;
  /** 权利要求原文摘录 */
  claimExcerpt?: string;
  /** 用户方案中的重叠技术点 */
  overlapPoint?: string;
}

/** 规避建议 */
export interface AvoidanceAdvice {
  patentId: string;
  pn: string;
  /** 围绕设计 / 替代方案 */
  advices: string[];
}

// ===== Zod Schemas =====

export const RiskAssessmentSchema = z.object({
  patentId: z.string(),
  pn: z.string(),
  title: z.string(),
  riskLevel: z.enum(["high", "medium", "low"]),
  matchedClaims: z.array(z.number()),
  analysis: z.string(),
  avoidanceAdvice: z.string(),
  claimRef: z.number().optional(),
  claimExcerpt: z.string().optional(),
  overlapPoint: z.string().optional(),
});

export const AvoidanceAdviceSchema = z.object({
  patentId: z.string(),
  pn: z.string(),
  advices: z.array(z.string()),
});
