"use client";

/**
 * PatentCard — 专利摘要卡片
 *
 * 在检索结果列表、竞品监控等场景复用。
 * 显示专利标题、专利权人、日期、IPC 等信息。
 */

import { cn } from "@/lib/utils";
import { FileText, Building2, Calendar, ExternalLink } from "lucide-react";
import type { PatentSummary } from "@/lib/types";

interface PatentCardProps {
  patent: PatentSummary;
  className?: string;
  onClick?: () => void;
}

/** 将 YYYYMMDD 格式转为 YYYY-MM-DD */
function formatDate(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function PatentCard({ patent, className, onClick }: PatentCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/10 transition-colors",
        "bg-white dark:bg-zinc-900",
        className,
      )}
    >
      {/* 标题 + 公开号 */}
      <div className="flex items-start gap-2 mb-2">
        <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-snug line-clamp-2">
            {patent.title}
          </h4>
          <span className="text-xs font-mono text-muted-foreground">
            {patent.pn}
          </span>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building2 className="size-3" />
          {patent.originalAssignee}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="size-3" />
          申请 {formatDate(patent.apdt)}
        </span>
        <span className="font-mono">{patent.authority}</span>
      </div>

      {/* 发明人（截断） */}
      {patent.inventor && (
        <p className="text-xs text-muted-foreground mt-1.5 truncate">
          {patent.inventor.split("|").slice(0, 3).join(" / ")}
        </p>
      )}

      {/* 在线预览按钮 */}
      {onClick && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            <ExternalLink className="size-3" />
            在线预览
          </button>
        </div>
      )}
    </div>
  );
}
