"use client";

/**
 * StepCard — 步骤状态卡片
 *
 * 显示 4 步流水线中每一步的状态（pending/running/success/error），
 * 含步骤名称、状态图标、耗时、详情按钮入口。
 */

import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, Circle, AlertCircle, ChevronRight } from "lucide-react";
import type { StepRecord } from "@/lib/session/types";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="size-5 text-muted-foreground" />,
  running: <Loader2 className="size-5 animate-spin text-blue-500" />,
  success: <CheckCircle className="size-5 text-green-500" />,
  error: <AlertCircle className="size-5 text-red-500" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "进行中",
  success: "已完成",
  error: "失败",
};

interface StepCardProps {
  stepNumber: number;
  name: string;
  status: string;
  duration?: string;
  stepRecord?: StepRecord;
  onViewDetail?: () => void;
}

export function StepCard({
  stepNumber,
  name,
  status,
  duration,
  onViewDetail,
}: StepCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 transition-colors",
        status === "running" && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
        status === "success" && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
        status === "error" && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
        status === "pending" && "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
      )}
    >
      {/* 步骤编号 */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          status === "success" && "bg-green-500 text-white",
          status === "running" && "bg-blue-500 text-white",
          status === "error" && "bg-red-500 text-white",
          status === "pending" && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
        )}
      >
        {status === "success" ? (
          <CheckCircle className="size-4" />
        ) : (
          stepNumber
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <span
            className={cn(
              "text-xs rounded-full px-2 py-0.5",
              status === "running" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
              status === "success" && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
              status === "error" && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
              status === "pending" && "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
            )}
          >
            {STATUS_LABELS[status] || status}
          </span>
        </div>
        {duration && (
          <p className="text-xs text-muted-foreground mt-0.5">{duration}</p>
        )}
      </div>

      {/* 状态图标 */}
      <div className="shrink-0">{STATUS_ICONS[status]}</div>

      {/* 详情按钮 */}
      {onViewDetail && (status === "success" || status === "error") && (
        <button
          onClick={onViewDetail}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          详情
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}
