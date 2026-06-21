"use client";

/**
 * FtoHistorySidebar — FTO 分析历史侧边栏
 *
 * 读 localStorage fto-history，点击可回顾历史报告。
 * 支持运行中（🔄 spinner）和已完成（✅ checkmark）两种状态。
 * 宽 240px，固定于 Copilot 页面左侧。
 */

import { Shield, Plus, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { RiskBadge } from "@/components/shared/RiskBadge";
import type { FtoHistoryItem } from "@/lib/types";

interface FtoHistorySidebarProps {
  history: FtoHistoryItem[];
  onSelectHistory: (item: FtoHistoryItem) => void;
  onNewAnalysis: () => void;
}

export function FtoHistorySidebar({
  history,
  onSelectHistory,
  onNewAnalysis,
}: FtoHistorySidebarProps) {
  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days <= 7) return `${days} 天前`;
    return `${Math.floor(days / 7)} 周前`;
  };

  const runningItems = history.filter((h) => h.status === "running");
  const completedItems = history.filter((h) => h.status !== "running");

  return (
    <aside className="w-60 shrink-0 border-r bg-white dark:bg-zinc-950 p-3 space-y-3 overflow-y-auto flex flex-col h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="size-3.5" />
          FTO 历史
        </h3>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <Shield className="size-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">暂无记录</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            运行首次分析后自动保存
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {/* 运行中的任务 */}
          {runningItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                运行中
              </p>
              {runningItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full text-left rounded-lg p-2.5 border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors space-y-1"
                >
                  <div className="flex items-start gap-1.5">
                    <Loader2 className="size-3 text-blue-500 animate-spin shrink-0 mt-0.5" />
                    <p className="text-xs font-medium line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    🔄 后台运行中
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* 已完成的任务 */}
          {completedItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                已完成
              </p>
              {completedItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item)}
                  className="w-full text-left rounded-lg p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors space-y-1"
                >
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="size-3 text-green-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RiskBadge level={item.riskLevel ?? "low"} />
                    <span className="text-[10px] text-muted-foreground">
                      {item.stats.total > 0
                        ? `${item.stats.total}件 · ${item.stats.high}高${item.stats.medium}中`
                        : "等待结果..."}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {timeAgo(item.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 新建分析按钮 */}
      <button
        onClick={onNewAnalysis}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shrink-0"
      >
        <Plus className="size-3.5" />
        新建分析
      </button>
    </aside>
  );
}
