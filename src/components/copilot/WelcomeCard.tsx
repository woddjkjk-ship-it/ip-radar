"use client";

/**
 * WelcomeCard — FTO Copilot 欢迎卡片
 *
 * 包装 InputPanel，作为分析入口的第一屏。
 * 用语友好化，面向研发工程师。
 */

import { InputPanel } from "@/components/copilot/InputPanel";

interface WelcomeCardProps {
  onSubmit: (text: string, competitors: string[], imageRef?: string) => void;
  disabled?: boolean;
}

export function WelcomeCard({ onSubmit, disabled }: WelcomeCardProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold">FTO 初筛 Copilot — 研发前置专利风险自查</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-lg mx-auto">
          在提交技术方案给 IP 团队正式评审之前，先用这里做一轮自查。
          输入你的技术方案（可附图），2 分钟生成一份 FTO 初筛报告：
          识别潜在侵权风险、标注命中的权利要求条款、给出具体规避建议。
        </p>
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 p-6">
        <InputPanel onSubmit={onSubmit} disabled={disabled} />
      </div>
    </div>
  );
}
