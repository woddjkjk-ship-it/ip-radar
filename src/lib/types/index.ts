/**
 * 全局类型导出
 *
 * 所有模块从此文件导入共享类型，避免循环依赖。
 */

export type {
  PatentSummary,
  Claim,
  LegalStatus,
  PatentDetail,
  MonitorUpdate,
  SearchResult,
} from "./patent";
export { PatentSummarySchema, ClaimSchema, PatentDetailSchema, SearchResultSchema } from "./patent";

export type { RiskLevel, RiskAssessment, AvoidanceAdvice } from "./risk";
export { RiskAssessmentSchema, AvoidanceAdviceSchema } from "./risk";

// 本地使用（不重复 export，上面已 re-export）
import type { RiskLevel as RiskLevelLocal } from "./risk";

export type { TechElements, UnderstandStepOutput } from "./tech-elements";
export { TechElementsSchema } from "./tech-elements";

export type { FtoReport, PatentRiskItem } from "./report";
export { FtoReportSchema, PatentRiskItemSchema } from "./report";

// ===== localStorage 持久化类型 =====

/** FTO 分析历史记录（存入 localStorage fto-history） */
export interface FtoHistoryItem {
  id: string;
  title: string;
  keywords: string[];
  riskLevel: "high" | "medium" | "low";
  stats: { total: number; high: number; medium: number };
  createdAt: string; // ISO
  reportJson: string; // JSON.stringify(FtoReport)
  /** 任务状态：running = 后台运行中, completed = 已完成 */
  status?: "running" | "completed";
}

/** 专利检索历史记录（存入 localStorage patent-search-history） */
export interface SearchHistoryItem {
  id: string;
  query: string; // 用户输入的检索词（专利号模式下为逗号拼接，截断50字）
  mode: "keyword" | "semantic" | "company" | "pn";
  resultCount: number;
  createdAt: string; // ISO 8601
}

/** 技术布局任务历史（存入 localStorage landscape-history） */
export interface LandscapeHistoryItem {
  id: string;
  query: string; // 技术主题词
  from: number; // 起始年份
  to: number; // 截止年份
  authorities: string[]; // 受理局
  tabsLoaded: ("trend" | "players" | "hotwords" | "status" | "competition")[];
  createdAt: string; // ISO 8601
}

/** 竞品监控订阅（存入 localStorage monitor-subscriptions） */
export interface MonitorSubscription {
  id: string;
  name: string;
  query: string;
  companies?: string[];
  frequency: "realtime" | "daily" | "weekly";
  pushChannel?: ("site" | "feishu")[];
  ipcFilter?: string[];
  authorityFilter?: string[];
  createdAt: string; // ISO
  lastTriggered?: string; // ISO
  newCount?: number;
  status: "active" | "paused";
}

/** 竞品监控 Feed 项（API 返回 + 前端扩展） */
export interface MonitorFeedItem {
  patentId: string;
  pn: string;
  title: string;
  originalAssignee: string;
  pbdt: number;
  authority: string;
  riskLevel: RiskLevelLocal;
  matchedTopics?: string[];
  ipcClasses?: string[];
}
