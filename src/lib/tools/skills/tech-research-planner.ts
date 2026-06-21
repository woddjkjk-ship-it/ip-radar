/**
 * tech_research_planner — 技术调研 AI 助手 Skill
 *
 * 将模糊的技术调研需求转化为精确的调研参数并触发分析。
 * 使用结构化输出模式（非 function calling）。
 */

import type { SkillDefinition, SkillInput, SkillResult } from "@/lib/tools/types";
import { toolRouter } from "@/lib/tools/router";
import { logStore } from "@/lib/log-store";
import { analyticsTrend, analyticsApplicant, patentKeywordSearch } from "@/lib/tools/registry";

export const techResearchPlanner: SkillDefinition = {
  name: "tech_research_planner",
  displayName: "AI 调研助手",
  description: "将模糊的技术调研需求转化为精确的调研参数并触发分析",
  systemPrompt: `你是 IP Radar 技术调研 AI 助手。将用户的调研需求转化为精确参数。

## 能力
- 技术领域提炼：口语化描述 → 精确技术主题词
- 参数推荐：年份范围、受理局、IPC 分类
- 调研方向判断：趋势分析 / 玩家排名 / 技术热词 / 法律状态 / 竞争格局

## 规则
- 未指定年份 → 默认近 5 年（当前年份 - 4 至当前年份）
- 未指定受理局 → 默认 CN + US
- "谁最厉害/排名" → 侧重 players Tab
- "趋势/变化" → 侧重 trend Tab
- "空白/机会" → 侧重 status Tab
- 提到具体国家 → 加入受理局列表

请返回结构化 JSON：
{
  "query": "精确技术主题词",
  "from": 起始年份,
  "to": 截止年份,
  "authorities": ["受理局代码"]
}`,

  tools: [analyticsTrend, analyticsApplicant, patentKeywordSearch],
};

export async function executeTechResearchPlanner(input: SkillInput): Promise<SkillResult> {
  logStore.append({
    type: "system",
    title: "AI 调研助手 启动",
    action: input.userInput,
  });

  const rawParams = await toolRouter.extractParams(
    input.userInput,
    techResearchPlanner.systemPrompt,
  );

  // 规范化 LLM 参数名变体
  const params: Record<string, unknown> = { ...rawParams };
  if (params.query_text !== undefined && params.query === undefined) params.query = params.query_text;
  if (params.topic !== undefined && params.query === undefined) params.query = params.topic;
  if (params.keyword !== undefined && params.query === undefined) params.query = params.keyword;
  if (params.start_year !== undefined && params.from === undefined) params.from = params.start_year;
  if (params.end_year !== undefined && params.to === undefined) params.to = params.end_year;
  if (params.startYear !== undefined && params.from === undefined) params.from = params.startYear;
  if (params.endYear !== undefined && params.to === undefined) params.to = params.endYear;
  if (params.jurisdictions !== undefined && params.authorities === undefined) params.authorities = params.jurisdictions;

  logStore.append({
    type: "llm",
    title: "DeepSeek — 参数提炼",
    action: `主题=${params.query ?? input.userInput}, ${params.from ?? "2021"}-${params.to ?? "2026"}, ${(params.authorities as string[])?.join("+") ?? "CN+US"}`,
    fullRequest: toolRouter.lastRequest,
    fullResponse: toolRouter.lastResponse,
  });

  // 如果 LLM 解析失败，降级
  if (!params.query || typeof params.query !== "string" || params.query.length < 2) {
    logStore.append({
      type: "system",
      title: "AI 调研助手 降级",
      action: `参数解析失败，原始输入"${input.userInput.slice(0, 50)}"填入主题词框`,
    });
    return {
      success: false,
      action: {
        type: "fill_and_search",
        params: {
          query: input.userInput,
          from: new Date().getFullYear() - 4,
          to: new Date().getFullYear(),
          authorities: ["CN", "US"],
        },
        autoSubmit: false,
      },
      fallbackInput: input.userInput,
    };
  }

  logStore.append({
    type: "system",
    title: "AI 调研助手 完成",
    action: `填入主题词"${params.query}"，自动触发`,
  });

  return {
    success: true,
    action: {
      type: "fill_and_search",
      params: {
        query: params.query,
        from: (params.from as number) ?? new Date().getFullYear() - 4,
        to: (params.to as number) ?? new Date().getFullYear(),
        authorities: (params.authorities as string[]) ?? ["CN", "US"],
      },
      autoSubmit: true,
    },
  };
}
