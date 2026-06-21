/**
 * 竞品监控订阅 — 默认 2 条示例
 *
 * monitor-subscriptions localStorage 为空时自动初始化。
 */

export interface MonitorSubscriptionDefault {
  id: string;
  name: string;
  query: string;
  companies?: string[];
  frequency: "realtime" | "daily" | "weekly";
  createdAt: string; // ISO 8601
  lastTriggered?: string; // ISO 8601
  newCount?: number;
  status: "active" | "paused";
}

export const DEFAULT_SUBSCRIPTIONS: MonitorSubscriptionDefault[] = [
  {
    id: "sub_demo_001",
    name: "BEV感知 — 竞品追踪",
    query: 'TACD:"BEV perception" AND PA:(Waymo OR Tesla)',
    companies: ["Waymo", "Tesla"],
    frequency: "daily",
    createdAt: "2026-05-10T09:00:00Z",
    lastTriggered: "2026-05-23T08:30:00Z",
    newCount: 3,
    status: "active",
  },
  {
    id: "sub_demo_002",
    name: "端到端规划 — Waymo专项",
    query: 'TACD:"end-to-end planning" AND PA:Waymo',
    companies: ["Waymo"],
    frequency: "weekly",
    createdAt: "2026-05-01T10:00:00Z",
    lastTriggered: "2026-05-19T08:00:00Z",
    newCount: 1,
    status: "active",
  },
];
