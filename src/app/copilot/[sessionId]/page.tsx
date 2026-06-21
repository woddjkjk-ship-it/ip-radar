"use client";

/**
 * Copilot 会话恢复页 — /copilot/[sessionId]
 *
 * 用户刷新页面或分享链接时，通过 sessionId 恢复会话状态。
 * 展示所有 4 步的状态和已有结果。
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { StepCard } from "@/components/copilot/StepCard";
import { RiskCard } from "@/components/copilot/RiskCard";
import { ReportPreview } from "@/components/copilot/ReportPreview";
import { StepDetailDrawer } from "@/components/copilot/StepDetailDrawer";
import { usePatentPreview } from "@/lib/patent-preview-context";
import type { CopilotSession, StepRecord } from "@/lib/session/types";
import type { RiskAssessment } from "@/lib/types";

export default function CopilotSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;

  const [session, setSession] = useState<CopilotSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStep, setDetailStep] = useState<StepRecord | undefined>();
  const { openPreview } = usePatentPreview();

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/copilot/session/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Session not found`);
        return res.json();
      })
      .then((data) => {
        setSession(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-red-600">会话未找到: {error}</p>
      </div>
    );
  }

  const assessments =
    (session.steps[3]?.output as { assessments?: RiskAssessment[] })?.assessments ?? [];
  const reportOutput = session.steps[4]?.output as
    | { markdown?: string; title?: string }
    | undefined;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">⚡ FTO Copilot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          会话 {sessionId} — 创建于{" "}
          {new Date(session.createdAt).toLocaleString("zh-CN")}
        </p>
      </div>

      {/* 步骤进度 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          分析进度
        </h3>
        {Object.entries(session.steps).map(([num, step]) => (
          <StepCard
            key={num}
            stepNumber={Number(num)}
            name={step.name}
            status={step.status}
            stepRecord={step}
            onViewDetail={() => {
              setDetailStep(step);
              setDetailOpen(true);
            }}
          />
        ))}
      </div>

      {/* 风险评估 */}
      {assessments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            风险评估结果
          </h3>
          {assessments.map((a, i) => (
            <RiskCard
              key={a.patentId}
              assessment={a}
              index={i}
              onClick={() => openPreview({
                patentId: a.patentId, pn: a.pn, apno: "",
                title: a.title, originalAssignee: "", currentAssignee: "",
                inventor: "", apdt: 0, pbdt: 0, authority: "",
              })}
            />
          ))}
        </div>
      )}

      {/* 报告 */}
      {reportOutput?.markdown && (
        <ReportPreview
          title={reportOutput.title ?? "FTO 初审报告"}
          markdown={reportOutput.markdown}
          sessionId={sessionId}
          onPatentClick={(p) => openPreview(p)}
        />
      )}

      {/* 详情抽屉 */}
      <StepDetailDrawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        stepRecord={detailStep}
      />
    </div>
  );
}
