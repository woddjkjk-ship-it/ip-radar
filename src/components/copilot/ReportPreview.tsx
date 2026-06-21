"use client";

/**
 * ReportPreview — FTO 报告预览（JSON 优先 + Markdown fallback）
 *
 * JSON 路径：SummaryCard → PatentRiskList → RecommendationList → MetaInfo
 * fallback：react-markdown 渲染纯文本。
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  ShieldAlert,
  ShieldMinus,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FtoReport, PatentRiskItem, PatentSummary } from "@/lib/types";

const RISK_BORDER: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-green-500",
};

const RISK_LABEL: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

const LEGAL_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "有效", variant: "default" },
  expired: { label: "失效", variant: "secondary" },
  pending: { label: "申请中", variant: "outline" },
  unknown: { label: "未知", variant: "secondary" },
};

interface ReportPreviewProps {
  title: string;
  markdown: string;
  sessionId: string;
  onPatentClick?: (patent: PatentSummary) => void;
}

/** 尝试解析 FtoReport，并对缺失字段做防御性填充 */
function tryParseReport(input: string): FtoReport | null {
  try {
    const obj = JSON.parse(input);
    if (obj && typeof obj === "object" && "riskLevel" in obj && "stats" in obj && "patentAnalysis" in obj) {
      const report = obj as FtoReport;
      // 防御：确保每个 patentAnalysis 条目的 matchedClaims 始终为数组
      if (Array.isArray(report.patentAnalysis)) {
        for (const item of report.patentAnalysis) {
          if (!Array.isArray(item.matchedClaims)) {
            item.matchedClaims = [];
          }
          // 防御：确保 riskLevel 归一化
          if (typeof item.riskLevel === "string") {
            item.riskLevel = item.riskLevel.toLowerCase() as "high" | "medium" | "low";
          }
        }
      }
      return report;
    }
    return null;
  } catch {
    return null;
  }
}

export function ReportPreview({ title, markdown, sessionId, onPatentClick }: ReportPreviewProps) {
  const report = tryParseReport(markdown);

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FTO_Report_${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (report) {
    return (
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-blue-500" />
            <h3 className="text-lg font-semibold">{report.title}</h3>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="size-4 mr-1" />
            下载 .json
          </Button>
        </div>

        {/* 1. SummaryCard */}
        <div
          className={cn(
            "rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden",
            RISK_BORDER[report.riskLevel] ?? "border-l-blue-500",
            "border-l-4",
          )}
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              {report.riskLevel === "high" && <ShieldAlert className="size-6 text-red-500" />}
              {report.riskLevel === "medium" && <ShieldMinus className="size-6 text-amber-500" />}
              {report.riskLevel === "low" && <ShieldCheck className="size-6 text-green-500" />}
              <div>
                <h2 className="text-xl font-bold">{report.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {report.executiveSummary}
                </p>
              </div>
            </div>

            {/* 4 格统计 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <p className="text-2xl font-bold">{report.stats.totalPatents}</p>
                <p className="text-xs text-muted-foreground">相关专利</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                <p className="text-2xl font-bold text-red-600">{report.stats.highRisk}</p>
                <p className="text-xs text-red-600">高风险</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <p className="text-2xl font-bold text-amber-600">{report.stats.mediumRisk}</p>
                <p className="text-xs text-amber-600">中风险</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                <p className="text-2xl font-bold text-green-600">{report.stats.lowRisk}</p>
                <p className="text-xs text-green-600">低风险</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PatentRiskList */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">专利风险分析</h3>
          <div className="space-y-3">
            {report.patentAnalysis.map((item, i) => (
              <PatentRiskCard
                key={item.pn}
                item={item}
                index={i}
                onClick={onPatentClick ? () => onPatentClick({
                  patentId: item.pn, pn: item.pn, apno: "",
                  title: item.title, originalAssignee: item.assignee,
                  currentAssignee: item.assignee, inventor: "",
                  apdt: 0, pbdt: 0, authority: "",
                }) : undefined}
              />
            ))}
          </div>
        </div>

        {/* 3. RecommendationList */}
        {report.recommendations.length > 0 && (
          <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-green-500" />
              规避与申请建议
            </h3>
            <ol className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 4. MetaInfo */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
          <span>生成时间：{new Date(report.generatedAt).toLocaleString("zh-CN")}</span>
          <span>模型：{report.modelUsed}</span>
          {report.tokenUsage && (
            <span>
              Token：输入 {report.tokenUsage.prompt} / 输出 {report.tokenUsage.completion}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── fallback：Markdown 渲染 ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-blue-500" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="size-4 mr-1" />
          下载
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-white dark:bg-zinc-900 p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

// ── 单条专利风险卡 ──

function PatentRiskCard({ item, index, onClick }: { item: PatentRiskItem; index: number; onClick?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-3",
        RISK_BORDER[item.riskLevel] ?? "",
        "border-l-4",
        onClick && "cursor-pointer hover:shadow-md",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <span className="text-xs font-mono text-muted-foreground">{item.pn}</span>
            <Badge variant={LEGAL_CONFIG[item.legalStatus]?.variant ?? "secondary"} className="text-[10px]">
              {LEGAL_CONFIG[item.legalStatus]?.label ?? item.legalStatus}
            </Badge>
          </div>
          <h4 className="text-sm font-semibold leading-snug">{item.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{item.assignee}</p>
        </div>
        <Badge
          className={cn(
            "text-xs font-bold shrink-0",
            item.riskLevel === "high" && "bg-red-500 text-white",
            item.riskLevel === "medium" && "bg-amber-500 text-white",
            item.riskLevel === "low" && "bg-green-500 text-white",
          )}
        >
          {RISK_LABEL[item.riskLevel]}
        </Badge>
      </div>

      {/* 命中权利要求 */}
      {item.matchedClaims?.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">命中权利要求：</span>
          {item.matchedClaims.map((c) => (
            <Badge key={c} variant="outline" className="text-[10px]">
              [{c}]
            </Badge>
          ))}
        </div>
      )}

      {/* 预览按钮 + 展开分析 */}
      <div className="flex items-center justify-between gap-2">
        {onClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
          >
            📄 预览
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 ml-auto"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? "收起分析" : "查看分析"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t pt-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">风险分析</p>
            <p className="text-sm leading-relaxed">{item.analysis}</p>
          </div>
          {item.avoidanceAdvice && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">规避建议</p>
              <p className="text-sm leading-relaxed">{item.avoidanceAdvice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
