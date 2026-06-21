/**
 * 技术布局历史 — 默认 3 条记录
 *
 * landscape-history localStorage 为空时自动初始化。
 */

export interface LandscapeHistoryDefaultItem {
  id: string;
  query: string;
  from: number;
  to: number;
  authorities: string[];
  tabsLoaded: ("trend" | "players" | "hotwords" | "status" | "competition")[];
  createdAt: string; // ISO 8601
}

export const DEFAULT_LANDSCAPE_HISTORY: LandscapeHistoryDefaultItem[] = [
  {
    id: "lh_1",
    query: "BEV感知",
    from: 2020,
    to: 2025,
    authorities: ["CN", "US", "EP"],
    tabsLoaded: ["trend", "players", "hotwords", "status", "competition"],
    createdAt: "2026-05-22T14:30:00Z",
  },
  {
    id: "lh_2",
    query: "传感器融合",
    from: 2018,
    to: 2025,
    authorities: ["CN", "US"],
    tabsLoaded: ["trend", "players"],
    createdAt: "2026-05-20T10:15:00Z",
  },
  {
    id: "lh_3",
    query: "端到端规划",
    from: 2019,
    to: 2025,
    authorities: ["CN", "US", "EP"],
    tabsLoaded: ["trend"],
    createdAt: "2026-05-15T09:00:00Z",
  },
];
