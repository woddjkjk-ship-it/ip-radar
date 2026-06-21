"use client";

/**
 * 📊 报告详情页 — /reports/[id]
 *
 * 优先从 fto-history localStorage 加载 JSON 报告，
 * 若无则回退 fixtures JSON 的 Markdown 内容。
 * 使用新版 ReportPreview 组件（JSON 优先 + Markdown fallback）。
 */

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReportPreview } from "@/components/copilot/ReportPreview";
import { usePatentPreview } from "@/lib/patent-preview-context";
import mockReportsJson from "@/fixtures/reports/mock-reports.json";
import type { FtoHistoryItem, PatentSummary } from "@/lib/types";

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const reportId = params?.id;
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const { openPreview } = usePatentPreview();

  useEffect(() => {
    // 优先从 localStorage fto-history 查找
    const ftoItems = safeReadJson<FtoHistoryItem[]>("fto-history", []);
    const found = ftoItems.find((h) => h.id === reportId);
    if (found) {
      setTitle(found.title);
      setContent(found.reportJson);
      return;
    }

    // 回退 fixtures
    const fixture = (mockReportsJson as Array<{
      id: string;
      title: string;
      content: string;
    }>).find((r) => r.id === reportId);
    if (fixture) {
      setTitle(fixture.title);
      setContent(fixture.content);
    }
  }, [reportId]);

  if (!content) {
    return (
      <div className="p-6">
        <Link href="/reports" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="size-3" /> 返回报告列表
        </Link>
        <p className="text-sm text-red-600">报告未找到</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/reports"
        className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="size-3" /> 返回报告列表
      </Link>
      <ReportPreview
        title={title || "FTO 分析报告"}
        markdown={content}
        sessionId={reportId ?? "unknown"}
        onPatentClick={(p) => openPreview(p)}
      />
    </div>
  );
}
