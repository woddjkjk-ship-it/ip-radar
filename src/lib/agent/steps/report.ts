/**
 * Step 4: 报告生成 — DeepSeek 生成结构化 FTO 报告（JSON）
 *
 * 流程：
 * 1. 汇总前 3 步输出（技术要素 + Top 专利 + 风险评估）
 * 2. 填入 report prompt 模板（要求 LLM 输出纯 JSON）
 * 3. zod safeParse 校验 → 失败重试 1 次
 * 4. 存入 SessionStore.reportContent
 *
 * LLM 不可用时（Mock 模式）使用硬编码 mock JSON 报告。
 */

import { SessionStore } from "@/lib/session/store";
import type { CopilotSession } from "@/lib/session/types";
import type { StepUpdate } from "@/lib/agent/stream";
import { getChatLLM } from "@/lib/llm/router";
import { FtoReportSchema } from "@/lib/types";
import type { FtoReport } from "@/lib/types";
import type { SearchOutput, AssessOutput, ReportInput, ReportOutput } from "@/lib/session/types";
import type { TechElements } from "@/lib/types";
import { readFileSync } from "fs";
import { join } from "path";

function loadPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "src/lib/llm/prompts", name), "utf-8");
}

/** 生成 mock JSON 报告 */
function mockJsonReport(
  elements: TechElements,
  assessmentItems: unknown[],
): FtoReport {
  const patentAnalysis = assessmentItems.slice(0, 4).map((item, i: number) => {
    const a = item as Record<string, unknown>;
    return {
      pn: (a.pn as string) ?? `PN-${i}`,
      title: (a.title as string) ?? "未知专利",
      assignee: (a.assignee as string) ?? (a.originalAssignee as string) ?? "未知",
      riskLevel: ((a.riskLevel as string) ?? "medium") as FtoReport["patentAnalysis"][0]["riskLevel"],
      matchedClaims: (a.matchedClaims as number[]) ?? (a.hitClaims as number[]) ?? [1],
      analysis: (a.analysis as string) ?? "Mock 分析结果",
      avoidanceAdvice: (a.avoidanceAdvice as string) ?? "建议 IP 团队评估",
      legalStatus: "active" as const,
    };
  });
  const highRisks = patentAnalysis.filter((p) => p.riskLevel?.toLowerCase() === "high").length;
  const medRisks = patentAnalysis.filter((p) => p.riskLevel?.toLowerCase() === "medium").length;

  return {
    title: `FTO 初审报告 — ${elements.novelty.slice(0, 30)}`,
    executiveSummary: `针对"${elements.keywords.slice(0, 3).join("、")}"技术方案的 FTO 初审分析，发现 ${patentAnalysis.length} 件相关专利。`,
    riskLevel: highRisks > 0 ? "high" : medRisks > 0 ? "medium" : "low",
    stats: {
      totalPatents: patentAnalysis.length,
      highRisk: highRisks,
      mediumRisk: medRisks,
      lowRisk: patentAnalysis.length - highRisks - medRisks,
    },
    patentAnalysis,
    recommendations: [
      "建议 IP 团队审核高风险专利的权利要求范围",
      "在技术交底书中标注与现有专利的差异化特征",
      "持续关注竞品专利的法律状态变化",
    ],
    generatedAt: new Date().toISOString(),
    modelUsed: "mock",
  };
}

export async function* stepReport(
  session: CopilotSession,
): AsyncGenerator<StepUpdate> {
  const step = 4 as const;
  const name = "报告生成";

  SessionStore.setStepStatus(session.id, step, "running");

  const step1Output = session.steps[1].output as { elements: TechElements; modified: boolean } | null;
  const step2Output = session.steps[2].output as SearchOutput | null;
  const step3Output = session.steps[3].output as AssessOutput | null;

  if (!step1Output?.elements || !step2Output?.topPatents || !step3Output?.assessments) {
    SessionStore.appendError(session.id, step, "前序步骤输出缺失");
    SessionStore.setStepStatus(session.id, step, "error");
    yield { sessionId: session.id, step, status: "error", name, error: "前序步骤输出缺失" };
    return;
  }

  const elements = step1Output.elements;
  const topPatents = step2Output.topPatents;
  const assessments = step3Output.assessments;

  const input: ReportInput = { elements, topPatents, assessments };
  SessionStore.setStepInput(session.id, step, input);

  yield { sessionId: session.id, step, status: "running", name };

  // ── 构建 prompt（JSON 格式要求）──
  let prompt = loadPrompt("report.md");
  prompt = prompt.replace("{{TITLE}}", elements.novelty.slice(0, 50) || "技术方案 FTO 分析");
  prompt = prompt.replace("{{DATE}}", new Date().toISOString().slice(0, 10));
  prompt = prompt.replace("{{SEARCH_SCOPE}}", "US / CN / EP");
  prompt = prompt.replace("{{COMPETITORS}}", session.competitors.join(", "));
  prompt = prompt.replace("{{PROBLEM}}", elements.problem);
  prompt = prompt.replace("{{SOLUTION}}", elements.solution);
  prompt = prompt.replace("{{NOVELTY}}", elements.novelty);

  // 填入评估结果（JSON 格式）
  const assessmentsJson = assessments.map((a) => ({
    风险等级: a.riskLevel,
    专利号: a.pn,
    标题: a.title,
    命中权利要求: a.matchedClaims,
    风险分析: a.analysis,
    规避建议: a.avoidanceAdvice,
  }));
  prompt = prompt.replace("{{ASSESSMENTS_JSON}}", JSON.stringify(assessmentsJson, null, 2));

  // ── LLM 生成 JSON 报告（最多重试 1 次）──
  let jsonReport: FtoReport | null = null;
  let rawOutput = "";
  let usedMock = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const chatLLM = getChatLLM();
      const result = await chatLLM.chat(
        [{ role: "user", content: prompt }],
        { temperature: 0.5, maxTokens: 4096 },
      );

      rawOutput = result.content;

      SessionStore.appendLlmCall(session.id, step, {
        model: result.model,
        provider: "deepseek",
        role: "chat",
        promptMessages: [{ role: "user", content: prompt }],
        rawResponse: result.content,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });

      // zod 校验：LLM 不输出 modelUsed/tokenUsage，先补全再校验
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(rawOutput);
      } catch {
        SessionStore.appendNote(session.id, step, `JSON parse 失败（第 ${attempt + 1} 次）`);
        continue;
      }
      if (parsedRaw && typeof parsedRaw === "object") {
        const obj = parsedRaw as Record<string, unknown>;
        if (!obj.modelUsed) obj.modelUsed = result.model;
        if (!obj.tokenUsage && result.usage) {
          obj.tokenUsage = { prompt: result.usage.promptTokens, completion: result.usage.completionTokens };
        }
      }
      const parsed = FtoReportSchema.safeParse(parsedRaw);
      if (parsed.success) {
        jsonReport = parsed.data;
        break;
      }

      SessionStore.appendNote(
        session.id,
        step,
        `JSON 校验失败（第 ${attempt + 1} 次），错误: ${parsed.error.message}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      SessionStore.appendNote(session.id, step, `LLM 调用失败（第 ${attempt + 1} 次）: ${msg}`);
    }
  }

  if (!jsonReport) {
    SessionStore.appendNote(session.id, step, "LLM JSON 生成失败，使用 Mock 报告");
    jsonReport = mockJsonReport(elements, assessments as unknown[]);
    usedMock = true;
  }

  // ── 输出 ──
  const markdown = JSON.stringify(jsonReport, null, 2);
  const output: ReportOutput = {
    markdown,
    title: jsonReport.title,
  };

  SessionStore.setStepOutput(session.id, step, output);
  SessionStore.setReportContent(session.id, markdown);
  if (usedMock) {
    SessionStore.appendNote(session.id, step, "使用 Mock 报告数据");
  }
  SessionStore.setStepStatus(session.id, step, "success");

  yield {
    sessionId: session.id,
    step,
    status: "success",
    name,
    output,
    reportContent: markdown,
    stepRecord: session.steps[step],
  };
}
