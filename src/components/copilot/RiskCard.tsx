"use client";

/**
 * RiskCard — 单条专利风险评估卡片
 *
 * 显示风险等级徽章、命中权利要求编号、风险分析和规避建议。
 */

import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, ShieldMinus } from "lucide-react";
import type { RiskAssessment } from "@/lib/types";

const RISK_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  high: {
    icon: <ShieldAlert className="size-5" />,
    label: "高风险",
    color: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
  },
  medium: {
    icon: <ShieldMinus className="size-5" />,
    label: "中风险",
    color: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  },
  low: {
    icon: <ShieldCheck className="size-5" />,
    label: "低风险",
    color: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
  },
};

interface RiskCardProps {
  assessment: RiskAssessment;
  index: number;
  onClick?: () => void;
}

export function RiskCard({ assessment, index, onClick }: RiskCardProps) {
  const config = RISK_CONFIG[assessment.riskLevel] ?? RISK_CONFIG.Low;

  return (
    <div
      className={cn("rounded-lg border p-4 space-y-3", config.color, onClick && "cursor-pointer hover:shadow-md")}
      onClick={onClick}
    >
      {/* 头部 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              #{index + 1}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {assessment.pn}
            </span>
          </div>
          <h4 className="text-sm font-semibold leading-snug">{assessment.title}</h4>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-xs font-bold",
            assessment.riskLevel === "high" &&
              "bg-red-500 text-white",
            assessment.riskLevel === "medium" &&
              "bg-amber-500 text-white",
            assessment.riskLevel === "low" &&
              "bg-green-500 text-white",
          )}
        >
          {config.icon}
          {config.label}
        </div>
      </div>

      {/* 命中权利要求 */}
      {assessment.matchedClaims.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            命中权利要求：
          </span>
          <span className="text-xs font-mono">
            {assessment.matchedClaims.map((c) => `Claim ${c}`).join("、")}
          </span>
        </div>
      )}

      {/* 命中依据 */}
      {assessment.claimExcerpt && (
        <div className="bg-white/60 dark:bg-zinc-900/60 rounded p-2.5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">命中依据</p>
          {assessment.claimRef && (
            <p className="text-xs text-muted-foreground">
              基于该专利权利要求第 {assessment.claimRef} 条：
            </p>
          )}
          <blockquote className="text-xs italic text-muted-foreground border-l-2 border-blue-300 pl-2">
            「{assessment.claimExcerpt}」
          </blockquote>
          {assessment.overlapPoint && (
            <p className="text-xs text-muted-foreground">
              — 与您方案中「<span className="font-medium text-red-600">{assessment.overlapPoint}</span>」存在重叠
            </p>
          )}
        </div>
      )}

      {/* 风险分析 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">风险分析</p>
        <p className="text-sm leading-relaxed">{assessment.analysis}</p>
      </div>

      {/* 规避建议 */}
      {assessment.avoidanceAdvice && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            规避建议
          </p>
          <p className="text-sm leading-relaxed">{assessment.avoidanceAdvice}</p>
        </div>
      )}

      {/* 预览按钮 */}
      {onClick && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
          >
            📄 预览
          </button>
        </div>
      )}
    </div>
  );
}
