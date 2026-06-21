"use client";

/**
 * LandscapeHistorySidebar — 技术布局历史侧边栏
 *
 * 左侧 240px，读 landscape-history localStorage。
 * 空值时用 fixture 初始化 3 条默认记录。
 */

import { Map, Trash2, Clock, Plus } from "lucide-react";
import type { LandscapeHistoryItem } from "@/lib/types";

function readLandscapeHistory(): LandscapeHistoryItem[] {
  try {
    const raw = localStorage.getItem("landscape-history");
    if (!raw) return [];
    return JSON.parse(raw) as LandscapeHistoryItem[];
  } catch {
    return [];
  }
}

function saveLandscapeHistory(items: LandscapeHistoryItem[]) {
  try {
    localStorage.setItem("landscape-history", JSON.stringify(items));
  } catch { /* ignore */ }
}

interface Props {
  history: LandscapeHistoryItem[];
  onSelect: (item: LandscapeHistoryItem) => void;
  onDelete: (idx: number) => void;
  /** 当前激活的查询词（用于高亮） */
  activeQuery?: string;
  /** 新增调研回调 */
  onNewResearch?: () => void;
}

export function LandscapeHistorySidebar({ history, onSelect, onDelete, activeQuery, onNewResearch }: Props) {
  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days <= 7) return `${days} 天前`;
    return `${Math.floor(days / 7)} 周前`;
  };

  return (
    <aside className="w-60 shrink-0 border-r bg-white dark:bg-zinc-950 p-3 space-y-3 overflow-y-auto flex flex-col h-full">
      <h3 className="text-xs font-semibold flex items-center gap-1.5">
        <Clock className="size-3.5" />
        分析历史
      </h3>
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无记录</p>
      ) : (
        <div className="flex-1 space-y-1 overflow-y-auto">
          {history.map((item, i) => {
            const isActive = activeQuery != null && item.query === activeQuery;
            return (
            <div
              key={item.id ?? i}
              className={`group relative rounded-lg p-2 cursor-pointer ${
                isActive
                  ? "bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <button onClick={() => onSelect(item)} className="w-full text-left">
                <p className="text-xs font-medium truncate">{item.query}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.from}—{item.to} · {item.authorities.join("/")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {item.tabsLoaded.length} 个 Tab · {timeAgo(item.createdAt)}
                </p>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(i);
                }}
                className="absolute right-1.5 top-1.5 hidden group-hover:inline-flex text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            );
          })}
        </div>
      )}
      {/* 新增调研按钮 */}
      {onNewResearch && (
        <button
          onClick={onNewResearch}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shrink-0"
        >
          <Plus className="size-3.5" />
          新增调研
        </button>
      )}
    </aside>
  );
}
