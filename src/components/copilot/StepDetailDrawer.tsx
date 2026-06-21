"use client";

/**
 * StepDetailDrawer — 步骤详情抽屉（全流程可追溯）
 *
 * 通过 shadcn Sheet 展示单个 Step 的完整记录：
 * - Overview：输入/输出概览
 * - LLM Calls：每次 LLM 调用的完整 prompt + response
 * - API Calls：每次外部 API 调用的 request + response
 * - Raw Data：原始 JSON 数据
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StepRecord } from "@/lib/session/types";

type TabKey = "overview" | "llm" | "api" | "raw";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "概览" },
  { key: "llm", label: "LLM 调用" },
  { key: "api", label: "API 调用" },
  { key: "raw", label: "原始数据" },
];

interface StepDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  stepRecord?: StepRecord;
}

export function StepDetailDrawer({
  open,
  onClose,
  stepRecord,
}: StepDetailDrawerProps) {
  const [tab, setTab] = useState<TabKey>("overview");

  if (!stepRecord) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            Step {stepRecord.step} — {stepRecord.name}
          </SheetTitle>
        </SheetHeader>

        {/* 元信息 */}
        <div className="flex items-center gap-2 mt-2 mb-4 text-xs text-muted-foreground">
          <Badge
            variant={
              stepRecord.status === "success"
                ? "default"
                : stepRecord.status === "error"
                  ? "destructive"
                  : "secondary"
            }
          >
            {stepRecord.status}
          </Badge>
          {stepRecord.startedAt && (
            <span>
              开始: {new Date(stepRecord.startedAt).toLocaleTimeString()}
            </span>
          )}
          {stepRecord.finishedAt && (
            <span>
              结束: {new Date(stepRecord.finishedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.key
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "llm" && stepRecord.llmCalls.length > 0 && (
                <span className="ml-1 text-xs">({stepRecord.llmCalls.length})</span>
              )}
              {t.key === "api" && stepRecord.apiCalls.length > 0 && (
                <span className="ml-1 text-xs">({stepRecord.apiCalls.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {tab === "overview" && (
            <OverviewTab stepRecord={stepRecord} />
          )}
          {tab === "llm" && (
            <LlmCallsTab llmCalls={stepRecord.llmCalls} />
          )}
          {tab === "api" && (
            <ApiCallsTab apiCalls={stepRecord.apiCalls} />
          )}
          {tab === "raw" && (
            <RawTab stepRecord={stepRecord} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-tabs ──

function OverviewTab({ stepRecord }: { stepRecord: StepRecord }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">输入</h4>
        <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-auto max-h-48">
          {JSON.stringify(stepRecord.input, null, 2)}
        </pre>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">输出</h4>
        <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-auto max-h-48">
          {JSON.stringify(stepRecord.output, null, 2)}
        </pre>
      </div>
      {stepRecord.notes && stepRecord.notes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">备注</h4>
          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
            {stepRecord.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {stepRecord.errors && stepRecord.errors.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-red-600">错误</h4>
          <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
            {stepRecord.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LlmCallsTab({ llmCalls }: { llmCalls: StepRecord["llmCalls"] }) {
  if (llmCalls.length === 0) {
    return <p className="text-sm text-muted-foreground">无 LLM 调用记录</p>;
  }
  return (
    <div className="space-y-6">
      {llmCalls.map((call, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{call.provider}</Badge>
            <Badge variant="outline">{call.role}</Badge>
            <span>{call.model}</span>
            <span>{call.latencyMs}ms</span>
            {call.usage && (
              <span>
                in:{call.usage.promptTokens} out:{call.usage.completionTokens}
              </span>
            )}
          </div>
          {call.error && (
            <p className="text-xs text-red-600">Error: {call.error}</p>
          )}
          <details>
            <summary className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400">
              Prompt Messages
            </summary>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2 overflow-auto max-h-64">
              {JSON.stringify(call.promptMessages, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400">
              Raw Response
            </summary>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2 overflow-auto max-h-64 whitespace-pre-wrap">
              {call.rawResponse}
            </pre>
          </details>
          {call.parsedOutput != null && (
            <details>
              <summary className="text-xs font-medium cursor-pointer text-green-600 dark:text-green-400">
                Parsed Output (zod validated)
              </summary>
              <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2 overflow-auto max-h-64">
                {JSON.stringify(call.parsedOutput, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function ApiCallsTab({ apiCalls }: { apiCalls: StepRecord["apiCalls"] }) {
  if (apiCalls.length === 0) {
    return <p className="text-sm text-muted-foreground">无 API 调用记录</p>;
  }
  return (
    <div className="space-y-4">
      {apiCalls.map((call, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{call.provider}</Badge>
            <span className="font-mono">{call.endpoint}</span>
            <span>{call.latencyMs}ms</span>
            {call.fallbackTriggered && (
              <Badge variant="destructive" className="text-xs">
                已降级
              </Badge>
            )}
          </div>
          {call.error && (
            <p className="text-xs text-red-600">Error: {call.error}</p>
          )}
          <details>
            <summary className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400">
              Request
            </summary>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2 overflow-auto max-h-48">
              {JSON.stringify(call.request, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400">
              Response
            </summary>
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2 overflow-auto max-h-48">
              {JSON.stringify(call.response, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}

function RawTab({ stepRecord }: { stepRecord: StepRecord }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">完整步骤记录</h4>
      <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 overflow-auto max-h-96">
        {JSON.stringify(
          {
            step: stepRecord.step,
            name: stepRecord.name,
            status: stepRecord.status,
            startedAt: stepRecord.startedAt,
            finishedAt: stepRecord.finishedAt,
            input: stepRecord.input,
            output: stepRecord.output,
            llmCalls: stepRecord.llmCalls.length,
            apiCalls: stepRecord.apiCalls.length,
            notes: stepRecord.notes,
            errors: stepRecord.errors,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
