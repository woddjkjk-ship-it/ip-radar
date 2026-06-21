/**
 * LogStore — 前端全局单例活动日志
 *
 * 各 API route / Agent pipeline / AI 助手执行时 append 日志，
 * ActivityLog 组件 subscribe 实时展示。
 *
 * 生产化时替换为 WebSocket / Redis pub-sub，接口不变。
 */

export type LogType = "api" | "llm" | "system";

export interface LogEntry {
  id: string;
  timestamp: string; // ISO 8601
  type: LogType;
  title: string; // "P002 关键词检索" / "DeepSeek — Step 1"
  action: string; // 动作描述
  params?: string; // 参数摘要
  result?: string; // 结果摘要
  fullRequest?: unknown; // 完整 request JSON
  fullResponse?: unknown; // 完整 response JSON
}

type Listener = () => void;

class LogStoreImpl {
  private entries: LogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private maxEntries = 200;

  append(entry: Omit<LogEntry, "id" | "timestamp">): void {
    const log: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(log);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this.listeners.forEach((fn) => fn());
  }

  getAll(): LogEntry[] {
    return [...this.entries];
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.entries = [];
    this.listeners.forEach((fn) => fn());
  }
}

/** 全局单例 */
export const logStore = new LogStoreImpl();
