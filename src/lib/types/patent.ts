/**
 * 专利核心数据模型 — 匹配智慧芽 DATA API 实际响应字段
 *
 * 字段命名遵循 API 返回的下划线风格，前端渲染时可按需映射为驼峰。
 */

import { z } from "zod";

// ===== 基础模型 =====

/** 专利摘要（搜索列表项） */
export interface PatentSummary {
  patentId: string; // 智慧芽内部 ID (UUID)
  pn: string; // 公开/公告号，如 US12296821B2
  apno: string; // 申请号
  title: string;
  originalAssignee: string;
  currentAssignee: string;
  inventor: string;
  apdt: number; // 申请日 YYYYMMDD
  pbdt: number; // 公开日 YYYYMMDD
  authority: string; // 受理局 US/CN/EP 等
}

/** 权利要求 */
export interface Claim {
  number: number;
  isIndependent: boolean;
  text: string;
  parentClaim?: number;
}

/** 法律状态 */
export type LegalStatus = "active" | "expired" | "pending" | "unknown";

/** 专利详情（含摘要/权利要求/法律状态） */
export interface PatentDetail extends PatentSummary {
  abstract?: string;
  claims: Claim[];
  legalStatus: LegalStatus;
  ipcClasses?: string[];
  familySize?: number;
}

// ===== Zod Schemas（用于 API 响应校验） =====

export const PatentSummarySchema = z.object({
  patentId: z.string(),
  pn: z.string(),
  apno: z.string(),
  title: z.string(),
  originalAssignee: z.string(),
  currentAssignee: z.string(),
  inventor: z.string(),
  apdt: z.number(),
  pbdt: z.number(),
  authority: z.string(),
});

export const ClaimSchema = z.object({
  number: z.number(),
  isIndependent: z.boolean(),
  text: z.string(),
  parentClaim: z.number().optional(),
});

export const PatentDetailSchema = PatentSummarySchema.extend({
  abstract: z.string().optional(),
  claims: z.array(ClaimSchema),
  legalStatus: z.enum(["active", "expired", "pending", "unknown"]),
  ipcClasses: z.array(z.string()).optional(),
  familySize: z.number().optional(),
});

/** 专利监控更新 */
export interface MonitorUpdate {
  monitorName: string;
  patentCount: number;
  patentIds: string[];
  updatedAt: string;
}

/** 搜索响应 */
export interface SearchResult {
  total: number;
  results: PatentSummary[];
}

export const SearchResultSchema = z.object({
  total: z.number(),
  results: z.array(PatentSummarySchema),
});
