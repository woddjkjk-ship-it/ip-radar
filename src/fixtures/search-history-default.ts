/**
 * 专利检索历史 — 默认 5 条记录
 *
 * patent-search-history localStorage 为空时自动初始化。
 */

export interface SearchHistoryDefaultItem {
  id: string;
  query: string;
  mode: "keyword" | "semantic" | "company" | "pn";
  resultCount: number;
  createdAt: string; // ISO 8601
}

export const DEFAULT_SEARCH_HISTORY: SearchHistoryDefaultItem[] = [
  {
    id: "sh_1",
    query: "时空注意力 传感器融合",
    mode: "keyword",
    resultCount: 47,
    createdAt: "2026-05-20T10:23:00Z",
  },
  {
    id: "sh_2",
    query: "一种基于毫米波雷达与摄像头融合的目标检测方法",
    mode: "semantic",
    resultCount: 23,
    createdAt: "2026-05-19T14:11:00Z",
  },
  {
    id: "sh_3",
    query: "Waymo",
    mode: "company",
    resultCount: 1024,
    createdAt: "2026-05-18T09:05:00Z",
  },
  {
    id: "sh_4",
    query: "端到端规划 BEV",
    mode: "keyword",
    resultCount: 31,
    createdAt: "2026-05-15T16:42:00Z",
  },
  {
    id: "sh_5",
    query: "US20240123456A1",
    mode: "pn",
    resultCount: 1,
    createdAt: "2026-05-10T11:30:00Z",
  },
];
