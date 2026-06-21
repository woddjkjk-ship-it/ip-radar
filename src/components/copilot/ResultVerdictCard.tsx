"use client";

/**
 * ResultVerdictCard — 整体风险裁定卡
 *
 * Step 4 完成后，在报告正文之前显示高亮的整体裁定。
 * 数据来源：FtoReport.riskLevel + FtoReport.stats。
 */

import { cn } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, ShieldMinus, Download, RotateCcw, Copy } from "lucide-react";
import type { FtoReport } from "@/lib/types";

const CONFIG = {
  high: {
    icon: ShieldAlert,
    label: "高风险",
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    textColor: "text-red-700 dark:text-red-300",
  },
  medium: {
    icon: ShieldMinus,
    label: "中风险",
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    textColor: "text-amber-700 dark:text-amber-300",
  },
  low: {
    icon: ShieldCheck,
    label: "低风险",
    borderColor: "border-l-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    textColor: "text-green-700 dark:text-green-300",
  },
};

interface ResultVerdictCardProps {
  report: FtoReport;
  sessionId: string;
  onReset: () => void;
}

export function ResultVerdictCard({ report, sessionId, onReset }: ResultVerdictCardProps) {
  const c = CONFIG[report.riskLevel] ?? CONFIG.low;
  const Icon = c.icon;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/copilot?session=${sessionId}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <div className={cn("rounded-lg border-l-4 p-5 space-y-4", c.borderColor, c.bgColor)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn("size-8", c.textColor)} />
          <div>
            <h3 className={cn("text-lg font-bold", c.textColor)}>
              整体风险：{c.label}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              发现 {report.stats.totalPatents} 件相关专利，其中
              <span className="text-red-600 font-bold mx-1">{report.stats.highRisk} 件</span>
              高风险 ·
              <span className="text-amber-600 font-bold mx-1">{report.stats.mediumRisk} 件</span>
              中风险 ·
              <span className="text-green-600 font-bold mx-1">{report.stats.lowRisk} 件</span>
              低风险
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white dark:hover:bg-zinc-800 transition-colors">
          <Download className="size-3.5" />
          下载报告 PDF
        </button>
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white dark:hover:bg-zinc-800 transition-colors"
        >
          <Copy className="size-3.5" />
          复制链接
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white dark:hover:bg-zinc-800 transition-colors"
        >
          <RotateCcw className="size-3.5" />
          重新分析
        </button>
      </div>
    </div>
  );
}
