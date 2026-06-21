"use client";

/**
 * NextActionsCard — 下一步行动建议卡
 *
 * 分析完成后给出研发视角的可执行下一步建议。
 * 按风险级别渲染不同建议。
 */

import { ShieldAlert, ShieldMinus, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

const ACTIONS: Record<string, { icon: React.ReactNode; items: string[] }> = {
  high: {
    icon: <ShieldAlert className="size-5 text-red-500" />,
    items: [
      "将此报告发给 IP 团队，讨论技术规避方案（修改方案使其绕开高风险权利要求）",
      "不建议在规避方案确定前提交专利申请",
      "可在专利检索模块深入查看高风险专利的权利要求全文",
    ],
  },
  medium: {
    icon: <ShieldMinus className="size-5 text-amber-500" />,
    items: [
      "中风险专利需关注：建议 IP 团队评估是否影响你的核心方案",
      "可将报告附于技术交底书中提交，供 IP 团队参考",
      "继续推进研发，同步跟踪这些竞品专利的法律状态变化",
    ],
  },
  low: {
    icon: <ShieldCheck className="size-5 text-green-500" />,
    items: [
      "专利风险较低，可继续推进研发",
      "建议将技术交底书提交给 IP 团队，争取公司内部专利申请名额",
      "在竞品监控模块订阅相关技术方向，持续关注竞品动向",
    ],
  },
};

interface NextActionsCardProps {
  riskLevel: "high" | "medium" | "low";
}

export function NextActionsCard({ riskLevel }: NextActionsCardProps) {
  const config = ACTIONS[riskLevel] ?? ACTIONS.low;

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {config.icon}
        下一步行动建议
      </h3>
      <ol className="space-y-2.5">
        {config.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="flex size-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-muted-foreground leading-relaxed">{item}</span>
          </li>
        ))}
      </ol>
      <Link
        href="/search"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
      >
        查看相关专利详情
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
