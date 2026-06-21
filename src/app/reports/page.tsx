"use client";

/**
 * 📊 报告中心 — FTO 报告列表 + 技术布局快照
 *
 * 来源：fto-history localStorage + 硬编码报告。
 * 每行含来源 badge 和操作按钮。
 */

import { useState, useEffect } from "react";
import { FileText, Clock, ChevronRight, Download, Trash2, Map } from "lucide-react";
import Link from "next/link";
import type { FtoHistoryItem } from "@/lib/types";

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToLocalStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

interface DisplayReport {
  id: string;
  title: string;
  source: "fto" | "landscape-snapshot";
  createdAt: string;
  riskSummary: { high: number; medium: number; low: number };
  raw?: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DisplayReport[]>([]);

  useEffect(() => {
    const ftoItems = safeReadJson<FtoHistoryItem[]>("fto-history", []);
    const fromFto: DisplayReport[] = ftoItems.map((h) => ({
      id: h.id,
      title: h.title,
      source: "fto" as const,
      createdAt: h.createdAt,
      riskSummary: { high: h.stats.high, medium: h.stats.medium, low: h.stats.total - h.stats.high - h.stats.medium },
      raw: h.reportJson,
    }));

    // 合并硬编码的报告（如果 fto-history 为空则显示）
    const hardcoded: DisplayReport[] = ftoItems.length === 0
      ? [
          {
            id: "report-001",
            title: "时空注意力多模态感知融合方案",
            source: "fto",
            createdAt: "2026-05-20T10:30:00Z",
            riskSummary: { high: 1, medium: 2, low: 1 },
          },
          {
            id: "report-002",
            title: "端到端自动驾驶规划与控制",
            source: "fto",
            createdAt: "2026-05-18T14:15:00Z",
            riskSummary: { high: 0, medium: 1, low: 3 },
          },
        ]
      : [];

    setReports([...fromFto, ...hardcoded]);
  }, []);

  const handleDelete = (id: string) => {
    const updated = reports.filter((r) => r.id !== id);
    setReports(updated);
    // 同步删除 localStorage
    const ftoItems = safeReadJson<FtoHistoryItem[]>("fto-history", []);
    saveToLocalStorage("fto-history", ftoItems.filter((h) => h.id !== id));
  };

  const handleDownload = (report: DisplayReport) => {
    const content = report.raw ?? JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Report_${report.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 报告中心</h1>
        <p className="text-sm text-muted-foreground mt-1">
          FTO 分析报告与技术布局快照存档
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <FileText className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">暂无报告</p>
          <p className="text-xs text-muted-foreground">
            运行 FTO Copilot 分析后，报告将自动归档至此处
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center gap-4 rounded-lg border bg-white dark:bg-zinc-900 p-5 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/10 transition-colors group"
            >
              <div
                className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${
                  report.source === "fto"
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-purple-100 dark:bg-purple-900"
                }`}
              >
                {report.source === "fto" ? (
                  <FileText className={`size-5 ${
                    report.source === "fto"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-purple-600 dark:text-purple-400"
                  }`} />
                ) : (
                  <Map className="size-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <Link href={`/reports/${report.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">{report.title}</h3>
                  <span
                    className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      report.source === "fto"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {report.source === "fto" ? "FTO分析" : "布局快照"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(report.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span>
                    🔴{report.riskSummary.high}{" "}
                    🟡{report.riskSummary.medium}{" "}
                    🟢{report.riskSummary.low}
                  </span>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(report)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                  title="下载 .json"
                >
                  <Download className="size-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 rounded"
                  title="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
