/**
 * smart_patent_search — 专利检索 AI 助手 Skill
 *
 * 理解自然语言检索需求，自动选择检索模式、提取参数并返回 UI 动作。
 * 不直接执行检索（由前端根据 SkillAction 填入表单并触发）。
 */

import type { SkillDefinition, SkillInput, SkillResult, SkillAction } from "@/lib/tools/types";
import { toolRouter } from "@/lib/tools/router";
import { logStore } from "@/lib/log-store";
import {
  patentKeywordSearch,
  patentSemanticSearch,
  patentCompanySearch,
  patentPnLookup,
} from "@/lib/tools/registry";

export const smartPatentSearch: SkillDefinition = {
  name: "smart_patent_search",
  displayName: "AI 智能检索",
  description: "理解自然语言检索需求，自动选择检索模式、提取参数并触发搜索",
  systemPrompt: `你是 IP Radar 专利检索 AI 助手。根据用户输入选择最合适的检索工具并填入参数。

## 能力
- 意图识别：关键词检索 / 语义检索 / 企业专利检索 / 专利号查询
- 实体抽取：公司名归一化、专利号格式识别、技术关键词、时间范围、受理局
- 检索式构建：组装 Patsnap 检索式（TACD/PA/APD/AN 语法）

## 路由规则
- 提到具体公司名 → patent_company_search
- 提到专利号（CN/US/EP/WO/JP/KR 开头 + 数字）→ patent_pn_lookup
- 技术概念描述较长（>30 字）→ patent_semantic_search
- 其他关键词描述 → patent_keyword_search`,

  tools: [patentKeywordSearch, patentSemanticSearch, patentCompanySearch, patentPnLookup],
};

/**
 * 执行 smart_patent_search Skill：
 * 1. Router 解析用户意图 → 选择 Tool + 参数
 * 2. 将 Tool 调用映射为 UI 动作（选中 Tab + 填入参数）
 * 3. 全流程日志写入 LogStore
 */
/** 规范化 LLM 返回的参数名（双向映射，覆盖 LLM 所有常见变体） */
function normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const p = { ...params };
  // ── 公司名 ──
  if (p.company_name !== undefined && p.company === undefined) p.company = p.company_name;
  if (p.companyName !== undefined && p.company === undefined) p.company = p.companyName;
  // ── 查询词（双向）──
  if (p.query_text !== undefined && p.query === undefined) p.query = p.query_text;
  if (p.queryText !== undefined && p.query === undefined) p.query = p.queryText;
  if (p.query !== undefined && p.query_text === undefined) p.query_text = p.query;
  // ── 关键词（单复数双向）──
  if (p.keywords !== undefined && p.keyword === undefined) p.keyword = p.keywords;
  if (p.keyword !== undefined && p.keywords === undefined) p.keywords = p.keyword;
  // ── 语义搜索文本 ──
  if (p.description !== undefined && p.text === undefined) p.text = p.description;
  if (p.text !== undefined && p.description === undefined) p.description = p.text;
  // ── 专利号（单复数双向）──
  if (p.pn !== undefined && p.pns === undefined) p.pns = typeof p.pn === "string" ? [p.pn] : p.pn;
  if (p.pns !== undefined && p.pn === undefined) p.pn = Array.isArray(p.pns) ? (p.pns as string[]).join(", ") : p.pns;
  // ── 专利号数组 → 逗号分隔字符串 ──
  if (Array.isArray(p.pns) && typeof p.pns !== "string") p.pns = (p.pns as string[]).join(", ");
  return p;
}

export async function executeSmartPatentSearch(input: SkillInput): Promise<SkillResult> {
  logStore.append({
    type: "system",
    title: "AI 智能检索 启动",
    action: input.userInput,
  });

  const routeResult = await toolRouter.route(
    input.userInput,
    smartPatentSearch.tools,
    smartPatentSearch.systemPrompt,
  );

  logStore.append({
    type: "llm",
    title: "DeepSeek — 意图路由",
    action: `识别意图 → ${routeResult.toolCalls.length > 0 ? routeResult.toolCalls.map((c) => c.name).join(", ") : "未识别"}`,
    params: JSON.stringify(routeResult.toolCalls),
    fullRequest: routeResult.rawRequest,
    fullResponse: routeResult.rawResponse,
  });

  if (routeResult.toolCalls.length === 0) {
    logStore.append({
      type: "system",
      title: "AI 智能检索 降级",
      action: `未识别意图，原始输入"${input.userInput.slice(0, 50)}"填入搜索框`,
    });
    return {
      success: false,
      action: { type: "fill_and_search", tab: "keyword", params: { query: input.userInput }, autoSubmit: false },
      fallbackInput: input.userInput,
    };
  }

  const call = routeResult.toolCalls[0];
  const params = normalizeParams(call.arguments);

  // 映射 Tool → UI Tab
  const tabMap: Record<string, string> = {
    patent_keyword_search: "keyword",
    patent_semantic_search: "semantic",
    patent_company_search: "company",
    patent_pn_lookup: "pn",
  };

  const tab = tabMap[call.name] ?? "keyword";
  let action: SkillAction;

  if (call.name === "patent_pn_lookup") {
    // pns 已经 normalizeParams 处理为逗号分隔字符串
    action = {
      type: "fill_and_search",
      tab: "pn",
      params: { pns: typeof params.pns === "string" ? params.pns : (Array.isArray(params.pns) ? (params.pns as string[]).join(", ") : input.userInput) },
      autoSubmit: true,
    };
  } else if (call.name === "patent_company_search") {
    action = {
      type: "fill_and_search",
      tab: "company",
      params: { company: params.company, keyword: (params.keyword ?? params.keywords ?? "") as string },
      autoSubmit: true,
    };
  } else if (call.name === "patent_semantic_search") {
    action = {
      type: "fill_and_search",
      tab: "semantic",
      params: { text: params.text ?? input.userInput },
      autoSubmit: true,
    };
  } else {
    // 关键词搜索：优先 LLM 提炼的 query，其次 query_text，最后原始输入
    const keywordQuery = (params.query ?? params.query_text ?? input.userInput) as string;
    action = {
      type: "fill_and_search",
      tab: "keyword",
      params: { query: keywordQuery },
      autoSubmit: true,
    };
  }

  logStore.append({
    type: "system",
    title: "AI 智能检索 完成",
    action: `选中「${tab}」Tab，填入参数，自动提交`,
  });

  return { success: true, action };
}
