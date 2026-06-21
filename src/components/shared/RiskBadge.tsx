"use client";

/**
 * RiskBadge — 风险等级徽章
 *
 * 在列表/表格中快速展示 High/Medium/Low 风险等级。
 */

import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/types";

const CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  high: {
    label: "高风险",
    className:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  },
  medium: {
    label: "中风险",
    className:
      "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  },
  low: {
    label: "低风险",
    className:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  },
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const config = CONFIG[level] ?? CONFIG.low;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
