/**
 * Step 2: 专利检索 — 并行三路搜索 + DeepSeek 智能去重融合
 *
 * 流程：
 * 1. 从 Step 1 输出获取 TechElements
 * 2. 并行调用：关键词搜索(P002) + 语义搜索(P008) + 竞品搜索(P004×N)
 * 3. 合并三路结果
 * 4. LLM 智能去重融合排序 → Top 10-20
 *
 * LLM 不可用时（Mock 模式）使用硬编码 mock 响应。
 */

import { z } from "zod";
import { PatentSummarySchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import type { CopilotSession } from "@/lib/session/types";
import type { StepUpdate } from "@/lib/agent/stream";
import type { PatentDataProvider } from "@/lib/providers/types";
import type { ChatLLM } from "@/lib/llm/types";
import { getProvider, callProvider } from "@/lib/providers";
import { getChatLLM } from "@/lib/llm/router";
import { mockDedupMerge } from "@/lib/agent/mock-responses";
import type { SearchInput, SearchOutput } from "@/lib/session/types";
import type { PatentSummary, TechElements } from "@/lib/types";
import { readFileSync } from "fs";
import { join } from "path";

function loadPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "src/lib/llm/prompts", name), "utf-8");
}

const TopPatentsSchema = z.object({
  topPatents: z.array(
    PatentSummarySchema.extend({
      relevancyReason: z.string().optional(),
    }),
  ),
  dedupNote: z.string().optional(),
});

/**
 * 将 PatentSummary 格式化为文本，用于填入 LLM prompt
 */
function formatPatentList(patents: { pn: string; title: string; originalAssignee: string; patentId: string }[]): string {
  return patents
    .map(
      (p, i) =>
        `${i + 1}. ${p.pn} — ${p.title}（${p.originalAssignee}）[ID: ${p.patentId}]`,
    )
    .join("\n");
}

export async function* stepSearch(
  session: CopilotSession,
): AsyncGenerator<StepUpdate> {
  const step = 2 as const;
  const name = "专利检索";

  SessionStore.setStepStatus(session.id, step, "running");

  const step1Output = session.steps[1].output as { elements: TechElements; modified: boolean } | null;
  if (!step1Output?.elements) {
    SessionStore.appendError(session.id, step, "Step 1 输出缺失，无法执行检索");
    SessionStore.setStepStatus(session.id, step, "error");
    yield { sessionId: session.id, step, status: "error", name, error: "Step 1 输出缺失" };
    return;
  }

  const elements = step1Output.elements;
  SessionStore.setStepInput(session.id, step, { elements } satisfies SearchInput);

  yield { sessionId: session.id, step, status: "running", name };

  const { provider } = await getProvider();

  // ── 并行三路搜索 ──
  const keywordQuery = `TACD: (${elements.keywords.slice(0, 5).join(" OR ")})`;
  const semanticQuery = elements.problemSolutionText.slice(0, 800);

  const [kwResult, semResult, ...compResults] = await Promise.allSettled([
    // 关键词搜索
    callProvider(provider, (p) =>
      p.searchByKeyword({ queryText: keywordQuery, limit: 15 }),
    ),
    // 语义搜索
    callProvider(provider, (p) =>
      p.searchBySemantic({ queryText: semanticQuery, limit: 15 }),
    ),
    // 竞品搜索（并行多个企业）
    ...elements.competitors.slice(0, 5).map((comp) =>
      callProvider(provider, (p) =>
        p.searchByCompany({ assignee: comp, limit: 10 }),
      ),
    ),
  ]);

  // ── 记录 API 调用日志 ──
  const logApiCall = (
    endpoint: string,
    result: PromiseSettledResult<{ data: unknown; meta: { kind: string; fallbackTriggered: boolean; latencyMs: number; error?: string } }>,
    request: unknown,
  ) => {
    if (result.status === "fulfilled") {
      SessionStore.appendApiCall(session.id, step, {
        provider: result.value.meta.kind as "patsnap" | "mock",
        endpoint,
        request,
        response: result.value.data,
        latencyMs: result.value.meta.latencyMs,
        fallbackTriggered: result.value.meta.fallbackTriggered,
        error: result.value.meta.error,
      });
    } else {
      SessionStore.appendApiCall(session.id, step, {
        provider: provider.kind,
        endpoint,
        request,
        response: null,
        latencyMs: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  };

  logApiCall("P002", kwResult, { queryText: keywordQuery, limit: 15 });
  logApiCall("P008", semResult, { queryText: semanticQuery, limit: 15 });
  elements.competitors.slice(0, 5).forEach((comp, i) => {
    logApiCall("P004", compResults[i], { assignee: comp, limit: 10 });
  });

  // ── 合并原始结果 ──
  const rawResults: SearchOutput["rawResults"] = {};

  const allPatents: PatentSummary[] = [];

  if (kwResult.status === "fulfilled") {
    const d = kwResult.value.data as { total: number; results: typeof allPatents };
    rawResults.keyword = { total: d.total, results: d.results };
    allPatents.push(...d.results);
  }
  if (semResult.status === "fulfilled") {
    const d = semResult.value.data as { total: number; results: typeof allPatents };
    rawResults.semantic = { total: d.total, results: d.results };
    allPatents.push(...d.results);
  }

  const companyResults: Record<string, { total: number; results: typeof allPatents }> = {};
  elements.competitors.slice(0, 5).forEach((comp, i) => {
    const r = compResults[i];
    if (r?.status === "fulfilled") {
      const d = r.value.data as { total: number; results: typeof allPatents };
      companyResults[comp] = { total: d.total, results: d.results };
      allPatents.push(...d.results);
    }
  });
  rawResults.companies = companyResults;

  // ── 按 patentId 去重（同一专利可能出现在多路搜索结果中）──
  const seen = new Set<string>();
  const dedupedPatents: PatentSummary[] = [];
  for (const p of allPatents) {
    if (!seen.has(p.patentId)) {
      seen.add(p.patentId);
      dedupedPatents.push(p);
    }
  }

  // ── LLM 去重融合 ──
  let topPatents: SearchOutput["topPatents"] = [];
  let dedupNote = "";

  // 所有搜索路径均无结果时跳过 LLM
  if (allPatents.length === 0) {
    SessionStore.appendNote(session.id, step, "所有搜索路径均无结果，跳过 LLM 去重融合");
    dedupNote = "未检索到相关专利";
  } else {
  try {
    const chatLLM = getChatLLM();
    let prompt = loadPrompt("dedup-merge.md");
    prompt = prompt.replace("{{PROBLEM}}", elements.problem);
    prompt = prompt.replace("{{SOLUTION}}", elements.solution);
    prompt = prompt.replace("{{NOVELTY}}", elements.novelty);
    prompt = prompt.replace("{{KEYWORDS}}", elements.keywords.join("、"));
    prompt = prompt.replace("{{TOP_N}}", "10");

    // 填入搜索结果
    prompt = prompt.replace("{{KW_TOTAL}}", String(rawResults.keyword?.total ?? 0));
    prompt = prompt.replace(
      "{{KEYWORD_RESULTS}}",
      formatPatentList(rawResults.keyword?.results ?? []),
    );
    prompt = prompt.replace("{{SEM_TOTAL}}", String(rawResults.semantic?.total ?? 0));
    prompt = prompt.replace(
      "{{SEMANTIC_RESULTS}}",
      formatPatentList(rawResults.semantic?.results ?? []),
    );

    // 竞品结果
    let companyBlock = "";
    for (const [comp, data] of Object.entries(companyResults)) {
      companyBlock += `- **${comp}**（${data.total} 条）\n${formatPatentList(data.results)}\n\n`;
    }
    prompt = prompt.replace(
      /{{#COMPANY_RESULTS}}[\s\S]*?{{\/COMPANY_RESULTS}}/g,
      companyBlock,
    );

    const result = await chatLLM.chat(
      [{ role: "user", content: prompt }],
      { responseFormat: "json_object", temperature: 0.3 },
    );

    const parsed = JSON.parse(result.content);
    const validated = TopPatentsSchema.safeParse(parsed);

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
      topPatents = validated.data.topPatents;
      dedupNote = validated.data.dedupNote ?? "";
    } else {
      throw new Error(`LLM 输出格式校验失败: ${validated.error.message}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    SessionStore.appendNote(session.id, step, `LLM 去重融合失败，使用 Mock 响应: ${msg}`);
    const mock = mockDedupMerge();
    topPatents = mock.topPatents;
    dedupNote = mock.dedupNote;
  }
  } // end else (allPatents.length > 0)

  const output: SearchOutput = { topPatents, rawResults };
  SessionStore.setStepOutput(session.id, step, { ...output, dedupNote });
  SessionStore.setStepStatus(session.id, step, "success");

  yield {
    sessionId: session.id,
    step,
    status: "success",
    name,
    output: { topPatents, rawResults, dedupNote },
    stepRecord: session.steps[step],
  };
}
