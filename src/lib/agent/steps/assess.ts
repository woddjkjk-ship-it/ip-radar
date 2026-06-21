/**
 * Step 3: 风险评估 — 获取专利详情 + DeepSeek 逐条评估
 *
 * 流程：
 * 1. 对 Step 2 输出的 Top 专利（取前 5 条），并行获取详情
 *    - P012 著录项目（摘要）
 *    - P018 权利要求
 *    - P041 法律状态
 * 2. 将权利要求 + 技术要素喂给 LLM 逐条评估
 * 3. 返回每条的 RiskLevel + matchedClaims + analysis + avoidanceAdvice
 *
 * LLM 不可用时（Mock 模式）使用硬编码 mock 响应。
 */

import { z } from "zod";
import { RiskAssessmentSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import type { CopilotSession } from "@/lib/session/types";
import type { StepUpdate } from "@/lib/agent/stream";
import type { PatentDataProvider } from "@/lib/providers/types";
import type { ChatLLM } from "@/lib/llm/types";
import { getProvider, callProvider } from "@/lib/providers";
import { getChatLLM } from "@/lib/llm/router";
import { mockAssess } from "@/lib/agent/mock-responses";
import type { SearchOutput, AssessInput, AssessOutput } from "@/lib/session/types";
import type { TechElements, Claim } from "@/lib/types";
import { readFileSync } from "fs";
import { join } from "path";

function loadPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "src/lib/llm/prompts", name), "utf-8");
}

const AssessOutputSchema = z.object({
  assessments: z.array(RiskAssessmentSchema),
});

/** 格式化权利要求列表 */
function formatClaims(claims: Claim[]): string {
  return claims
    .map(
      (c) =>
        `${c.number}. ${c.isIndependent ? "[独立] " : ""}${c.text.slice(0, 200)}`,
    )
    .join("\n");
}

export async function* stepAssess(
  session: CopilotSession,
): AsyncGenerator<StepUpdate> {
  const step = 3 as const;
  const name = "风险评估";

  SessionStore.setStepStatus(session.id, step, "running");

  const step2Output = session.steps[2].output as SearchOutput | null;
  const step1Output = session.steps[1].output as { elements: TechElements; modified: boolean } | null;

  if (!step2Output?.topPatents || !step1Output?.elements) {
    SessionStore.appendError(session.id, step, "前序步骤输出缺失");
    SessionStore.setStepStatus(session.id, step, "error");
    yield { sessionId: session.id, step, status: "error", name, error: "前序步骤输出缺失" };
    return;
  }

  const elements = step1Output.elements;
  // 取前 5 条做深度分析
  const top5 = step2Output.topPatents.slice(0, 5);

  SessionStore.setStepInput(session.id, step, { topPatents: top5, elements } satisfies AssessInput);

  yield { sessionId: session.id, step, status: "running", name };

  const { provider } = await getProvider();

  // ── 并行获取详情 ──
  const detailResults = await Promise.allSettled(
    top5.map((p) =>
      callProvider(provider, (prov) => prov.getDetail(p.patentId)),
    ),
  );

  // 记录 API 日志
  top5.forEach((p, i) => {
    const r = detailResults[i];
    SessionStore.appendApiCall(session.id, step, {
      provider: provider.kind,
      endpoint: "P012+P018+P041",
      request: { patentId: p.patentId },
      response: r.status === "fulfilled" ? { title: r.value.data?.title } : null,
      latencyMs: r.status === "fulfilled" ? r.value.meta.latencyMs : 0,
      fallbackTriggered: r.status === "fulfilled" ? r.value.meta.fallbackTriggered : false,
      error: r.status === "rejected" ? String(r.reason) : undefined,
    });
  });

  // ── 构建 prompt ──
  let prompt = loadPrompt("assess-risk.md");
  prompt = prompt.replace("{{PROBLEM}}", elements.problem);
  prompt = prompt.replace("{{SOLUTION}}", elements.solution);
  prompt = prompt.replace("{{NOVELTY}}", elements.novelty);

  // 填入专利信息
  let patentsBlock = "";
  top5.forEach((p, i) => {
    const r = detailResults[i];
    const detail = r?.status === "fulfilled" ? r.value.data as { abstract?: string; claims: Claim[] } : null;

    patentsBlock += `### 专利 ${i + 1}: ${p.pn} — ${p.title}\n`;
    patentsBlock += `**专利权人**: ${p.originalAssignee}\n`;
    patentsBlock += `**摘要**: ${detail?.abstract ?? "无"}\n\n`;
    patentsBlock += `**权利要求**:\n`;
    if (detail?.claims?.length) {
      patentsBlock += formatClaims(detail.claims) + "\n";
    } else {
      patentsBlock += "（无法获取权利要求）\n";
    }
    patentsBlock += "\n";
  });

  prompt = prompt.replace(
    /{{#PATENTS}}[\s\S]*?{{\/PATENTS}}/g,
    patentsBlock,
  );

  // ── LLM 评估 ──
  let assessments = mockAssess().slice(0, top5.length);
  let usedMock = false;

  try {
    const chatLLM = getChatLLM();
    const result = await chatLLM.chat(
      [{ role: "user", content: prompt }],
      { responseFormat: "json_object", temperature: 0.3 },
    );

    const parsed = JSON.parse(result.content);
    const validated = AssessOutputSchema.safeParse(parsed);

    SessionStore.appendLlmCall(session.id, step, {
      model: result.model,
      provider: "deepseek",
      role: "chat",
      promptMessages: [{ role: "user", content: prompt }],
      rawResponse: result.content,
      parsedOutput: validated.success ? validated.data : undefined,
      usage: result.usage,
      latencyMs: result.latencyMs,
      error: validated.success ? undefined : `zod validation failed: ${validated.error.message}`,
    });

    if (validated.success) {
      assessments = validated.data.assessments;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    SessionStore.appendNote(session.id, step, `LLM 评估失败，使用 Mock 响应: ${msg}`);
    usedMock = true;
  }

  const output: AssessOutput = { assessments };
  SessionStore.setStepOutput(session.id, step, output);
  if (usedMock) {
    SessionStore.appendNote(session.id, step, "使用 Mock 风险评估数据");
  }
  SessionStore.setStepStatus(session.id, step, "success");

  yield {
    sessionId: session.id,
    step,
    status: "success",
    name,
    output,
    stepRecord: session.steps[step],
  };
}
