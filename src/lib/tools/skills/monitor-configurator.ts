/**
 * monitor_configurator — 竞品监控 AI 助手 Skill
 *
 * 将自然语言监控需求转化为完整的监控订阅配置。
 * 使用结构化输出模式。
 */

import type { SkillDefinition, SkillInput, SkillResult } from "@/lib/tools/types";
import { toolRouter } from "@/lib/tools/router";
import { logStore } from "@/lib/log-store";
import { patentKeywordSearch, patentCompanySearch } from "@/lib/tools/registry";

export const monitorConfigurator: SkillDefinition = {
  name: "monitor_configurator",
  displayName: "AI 配置助手",
  description: "将自然语言监控需求转化为完整的监控订阅配置",
  systemPrompt: `你是 IP Radar 竞品监控配置 AI 助手。将监控需求转化为订阅配置。

## 能力
- 监控意图解析：技术动向监控 / 特定企业跟踪 / 侵权预警
- 检索式生成：含同义词扩展的 Patsnap 检索式
- 公司名归一化 + 关联企业推荐
- IPC 推断：从技术描述推断 IPC 前缀
- 频率建议 + 覆盖度自检

## 规则
- "紧急/立即/实时" → frequency: "realtime"
- "每天/日报" → frequency: "daily"
- 默认 → frequency: "weekly"
- 提到公司名 → 加入 companies 列表
- 检索式须包含同义词扩展

请返回完整订阅配置 JSON：
{
  "name": "订阅名称",
  "query": "Patsnap 检索式（含同义词扩展）",
  "companies": ["归一化公司名"],
  "frequency": "realtime|daily|weekly"
}`,

  tools: [patentKeywordSearch, patentCompanySearch],
};

export async function executeMonitorConfigurator(input: SkillInput): Promise<SkillResult> {
  logStore.append({
    type: "system",
    title: "AI 配置助手 启动",
    action: input.userInput,
  });

  const params = await toolRouter.extractParams(
    input.userInput,
    monitorConfigurator.systemPrompt,
  );

  logStore.append({
    type: "llm",
    title: "DeepSeek — 配置生成",
    action: `订阅="${params.name ?? "未命名"}", 频率=${params.frequency ?? "weekly"}, 企业=${(params.companies as string[])?.join(", ") ?? "无"}`,
    fullRequest: toolRouter.lastRequest,
    fullResponse: toolRouter.lastResponse,
  });

  if (!params.query || typeof params.query !== "string" || params.query.length < 3) {
    logStore.append({
      type: "system",
      title: "AI 配置助手 降级",
      action: `配置生成失败，原始输入"${input.userInput.slice(0, 50)}"填入检索式`,
    });
    return {
      success: false,
      action: {
        type: "fill_form",
        params: {
          name: "AI 生成订阅",
          query: input.userInput,
          companies: [],
          frequency: "weekly",
        },
        autoSubmit: false,
      },
      fallbackInput: input.userInput,
    };
  }

  logStore.append({
    type: "system",
    title: "AI 配置助手 完成",
    action: `生成订阅"${params.name ?? "AI 订阅"}"，待用户确认`,
  });

  return {
    success: true,
    action: {
      type: "fill_form",
      params: {
        name: params.name ?? "AI 生成订阅",
        query: params.query,
        companies: params.companies ?? [],
        frequency: params.frequency ?? "weekly",
      },
      autoSubmit: false, // 监控配置不自动提交
    },
  };
}
