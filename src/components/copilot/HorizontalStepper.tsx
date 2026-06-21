"use client";

/**
 * HorizontalStepper — 横向步骤条
 *
 * 4 步水平排列，每步占 1/4 宽度，圆圈在上、标签在下，严格对齐。
 * 已完成步骤可点击查看详情。
 */

import { cn } from "@/lib/utils";
import { CheckCircle, Loader2, Circle, AlertCircle } from "lucide-react";

interface StepInfo {
  status: string;
  name: string;
  duration?: string;
}

interface HorizontalStepperProps {
  steps: Record<number, StepInfo>;
  onClickStep?: (stepNum: number) => void;
}

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "提取技术要素与关键词",
  2: "并行检索三路专利数据库",
  3: "逐项评估侵权风险",
  4: "生成可导出的 FTO 报告",
};

export function HorizontalStepper({ steps, onClickStep }: HorizontalStepperProps) {
  const stepNums = [1, 2, 3, 4];

  return (
    <div className="w-full">
      {/* 4 列等宽网格：圆圈行 + 连线行 + 标签行 */}
      <div className="grid grid-cols-4 gap-0">
        {stepNums.map((num, idx) => {
          const step = steps[num];
          const status = step?.status ?? "pending";
          const isLast = idx === stepNums.length - 1;
          const isClickable = (status === "success" || status === "error") && onClickStep;
          const prevStatus = idx > 0 ? (steps[stepNums[idx - 1]]?.status ?? "pending") : "pending";

          return (
            <div key={num} className="flex flex-col items-center">
              {/* 圆圈 + 连线行 */}
              <div className="flex items-center w-full">
                {/* 左侧连线（第一步没有） */}
                {idx > 0 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5",
                      prevStatus === "success" ? "bg-green-400" : "bg-zinc-200 dark:bg-zinc-700",
                    )}
                  />
                )}

                {/* 圆圈 */}
                <button
                  disabled={!isClickable}
                  onClick={() => onClickStep?.(num)}
                  className={cn(
                    "relative flex items-center justify-center size-10 rounded-full border-2 shrink-0 transition-all",
                    status === "success" && "border-green-500 bg-green-500 text-white",
                    status === "running" && "border-blue-500 bg-blue-500 text-white",
                    status === "error" && "border-red-500 bg-red-500 text-white",
                    status === "pending" && "border-zinc-300 text-zinc-400 dark:border-zinc-600",
                    isClickable && "cursor-pointer hover:scale-110",
                    !isClickable && "cursor-default",
                  )}
                >
                  {status === "success" && <CheckCircle className="size-5" />}
                  {status === "running" && <Loader2 className="size-5 animate-spin" />}
                  {status === "error" && <AlertCircle className="size-5" />}
                  {status === "pending" && <span className="text-sm font-bold">{num}</span>}
                </button>

                {/* 右侧连线（最后一步没有） */}
                {!isLast && (
                  <div
                    className={cn(
                      "flex-1 h-0.5",
                      status === "success" ? "bg-green-400" : "bg-zinc-200 dark:bg-zinc-700",
                    )}
                  />
                )}
              </div>

              {/* 标签行 */}
              <div className="text-center mt-2 space-y-0.5 min-w-0 px-1 w-full">
                <p className="text-xs font-medium truncate">{step?.name ?? `Step ${num}`}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {STEP_DESCRIPTIONS[num]}
                </p>
                {step?.duration && (
                  <p className="text-[10px] text-muted-foreground">{step.duration}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
