/**
 * PatentDataProvider 抽象接口 — 隔离数据源
 *
 * Mock 实现读 fixtures JSON；Live 实现调智慧芽 DATA API。
 * UI 和 Agent 编排层只依赖此接口，不感知数据源。
 *
 * 接口设计基于 2026-05-24 API 实测确认的端点和响应格式。
 */

import type { PatentSummary, PatentDetail, Claim, MonitorUpdate, SearchResult } from "@/lib/types";

/** 数据提供商标识 */
export type ProviderKind = "mock" | "patsnap";

// ===== 搜索查询参数 =====

/** 关键词检索查询 */
export interface PatentSearchQuery {
  /** PatSnap 检索式，如 "TACD: autonomous driving" */
  queryText: string;
  collapseType?: "DOCDB";
  limit?: number; // 默认 10
  offset?: number; // 默认 0
}

/** 语义检索查询 */
export interface SemanticSearchQuery {
  /** 技术描述文本（建议 200 字以上） */
  queryText: string;
  collapseType?: "DOCDB";
  limit?: number;
  offset?: number;
}

/** 企业/竞品检索查询 */
export interface CompanySearchQuery {
  /** 企业名称，如 "Tesla" */
  assignee: string;
  collapseType?: "DOCDB";
  limit?: number;
  offset?: number;
}

// ===== Provider 接口 =====

export interface PatentDataProvider {
  /** 提供商标识，用于日志和降级判断 */
  readonly kind: ProviderKind;
  // ── 搜索类 ──
  /** 关键词检索 */
  searchByKeyword(q: PatentSearchQuery): Promise<SearchResult>;
  /** 语义检索 */
  searchBySemantic(q: SemanticSearchQuery): Promise<SearchResult>;
  /** 企业/竞品检索 */
  searchByCompany(q: CompanySearchQuery): Promise<SearchResult>;
  /** 专利号批量检索 */
  searchByPn(pns: string[], limit?: number): Promise<SearchResult>;
  /** 统计专利量 */
  countByQuery(queryText: string): Promise<number>;

  // ── 详情类 ──
  /** 获取专利详情（含摘要/权利要求/法律状态） */
  getDetail(patentId: string): Promise<PatentDetail>;
  /** 仅获取权利要求 */
  getClaims(patentId: string): Promise<Claim[]>;
  /** 仅获取法律状态 */
  getLegalStatus(patentId: string): Promise<string>;

  // ── PDF 类 ──
  /** 获取专利 PDF 签名 URL（P020） */
  getPdfUrl(pn: string): Promise<string>;

  // ── 监控类 ──
  /** 创建专利监控 */
  createMonitor(name: string, queryText: string): Promise<string>;
  /** 检查监控更新 */
  checkMonitorUpdates(monitorId: string): Promise<MonitorUpdate[]>;
}
