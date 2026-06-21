/**
 * AI 助手 Router — DeepSeek function calling 意图路由
 *
 * 两种模式：
 * 1. route() — function calling 模式，DeepSeek 自主选择 Tool（用于 smart_patent_search）
 * 2. extractParams() — 结构化输出模式，DeepSeek 返回 JSON 参数（用于 tech_research_planner / monitor_configurator）
 */

import type { ChatMessage } from "@/lib/llm/types";
import { getChatLLM } from "@/lib/llm/router";
import type { ToolDefinition, ToolCall, RouterResult } from "@/lib/tools/types";

/**
 * 将 Zod schema 转为简单的 JSON Schema 描述（供 DeepSeek tools 参数）。
 * 简化版：从 Zod schema 的 .describe() 中提取参数说明。
 */
function zodToToolParams(schema: ToolDefinition["inputSchema"]): Record<string, unknown> {
  try {
    // 从 Zod schema shape 构建 JSON Schema
    const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
    if (!shape) return { type: "object", properties: {} };

    const properties: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(shape)) {
      const zodField = field as { _def?: { typeName?: string; description?: string } };
      const typeName = zodField._def?.typeName;
      const desc = zodField._def?.description;
      properties[key] = {
        type: typeName === "ZodNumber" ? "number" : typeName === "ZodArray" ? "array" : "string",
        description: desc ?? key,
      };
    }
    return { type: "object", properties, required: Object.keys(shape) };
  } catch {
    return { type: "object", properties: {} };
  }
}

/**
 * 将 ToolDefinition[] 转为 DeepSeek tools 参数格式。
 */
function toDeepSeekTools(tools: ToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: zodToToolParams(t.inputSchema),
    },
  }));
}

/** 全局 router 实例（保留 lastRequest/lastResponse 供日志用） */
class ToolRouter {
  lastRequest: unknown = null;
  lastResponse: unknown = null;

  /**
   * Function calling 模式：DeepSeek 自主选择 Tool。
   * 用于 smart_patent_search Skill。
   */
  async route(
    userInput: string,
    availableTools: ToolDefinition[],
    skillPrompt: string,
  ): Promise<RouterResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: skillPrompt },
      { role: "user", content: userInput },
    ];

    const tools = toDeepSeekTools(availableTools);

    // 构建带 tools 的 prompt（DeepSeek Anthropic 协议不原生支持 tools，用 prompt engineering）
    const toolsDesc = availableTools
      .map((t) => `- **${t.name}**: ${t.description}`)
      .join("\n");

    const enhancedPrompt =
      `${skillPrompt}\n\n` +
      `## 可用工具\n${toolsDesc}\n\n` +
      `## 任务\n根据用户输入，选择最合适的工具并生成 JSON 格式的调用参数。\n` +
      `返回格式：\n` +
      `\`\`\`json\n` +
      `{\n` +
      `  "tool": "<工具名>",\n` +
      `  "params": { <工具参数> }\n` +
      `}\n` +
      `\`\`\`\n` +
      `如果用户输入不明确，返回 { "tool": null, "reason": "..." }。仅返回 JSON。`;

    try {
      const chatLLM = getChatLLM();
      const result = await chatLLM.chat(
        [{ role: "user", content: enhancedPrompt + "\n\n用户输入：" + userInput }],
        { responseFormat: "json_object", temperature: 0.1, maxTokens: 1024 },
      );

      this.lastRequest = { messages, enhancedPrompt };
      this.lastResponse = result.content;

      // 解析 LLM 响应（strip markdown 代码块 + 提取 JSON）
      let jsonText = result.content.trim();

      // 1. 去掉 ```json ... ``` 或 ``` ... ``` 包裹
      const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) {
        jsonText = fenceMatch[1].trim();
      }

      // 2. 提取第一个完整的 JSON 对象（平衡括号匹配）
      const firstBrace = jsonText.indexOf("{");
      if (firstBrace === -1) {
        return { toolCalls: [], rawRequest: this.lastRequest, rawResponse: result.content };
      }
      let depth = 0;
      let endIdx = -1;
      for (let i = firstBrace; i < jsonText.length; i++) {
        if (jsonText[i] === "{") depth++;
        else if (jsonText[i] === "}") {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      jsonText = endIdx > firstBrace
        ? jsonText.slice(firstBrace, endIdx + 1)
        : jsonText.slice(firstBrace); // 截断的 JSON — 尝试修复

      let parsed: { tool?: string | null; params?: Record<string, unknown>; reason?: string };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // JSON 截断：尝试补全尾部 }
        try {
          parsed = JSON.parse(jsonText + "}");
        } catch {
          try {
            parsed = JSON.parse(jsonText + "]}");
          } catch {
            return { toolCalls: [], rawRequest: this.lastRequest, rawResponse: result.content };
          }
        }
      }

      if (!parsed.tool) {
        return { toolCalls: [], rawRequest: this.lastRequest, rawResponse: result.content };
      }

      // 查找匹配的 Tool
      const tool = availableTools.find((t) => t.name === parsed.tool);
      if (!tool) {
        return { toolCalls: [], rawRequest: this.lastRequest, rawResponse: result.content };
      }

      return {
        toolCalls: [
          {
            name: tool.name,
            displayName: tool.displayName,
            arguments: parsed.params ?? {},
          },
        ],
        rawRequest: this.lastRequest,
        rawResponse: result.content,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolCalls: [], rawRequest: this.lastRequest, rawResponse: msg };
    }
  }

  /**
   * 结构化输出模式：DeepSeek 返回 JSON 参数。
   * 用于 tech_research_planner / monitor_configurator Skill。
   */
  async extractParams(
    userInput: string,
    skillPrompt: string,
  ): Promise<Record<string, unknown>> {
    const prompt = `${skillPrompt}\n\n请根据以下用户输入返回 JSON：\n\n${userInput}`;
    try {
      const chatLLM = getChatLLM();
      const result = await chatLLM.chat(
        [{ role: "user", content: prompt }],
        { responseFormat: "json_object", temperature: 0.1, maxTokens: 1024 },
      );
      this.lastRequest = { prompt };
      this.lastResponse = result.content;

      // 同 route() 的 JSON 提取逻辑
      let jsonText = result.content.trim();
      const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) jsonText = fenceMatch[1].trim();

      const firstBrace = jsonText.indexOf("{");
      if (firstBrace === -1) return {};
      let depth = 0, endIdx = -1;
      for (let i = firstBrace; i < jsonText.length; i++) {
        if (jsonText[i] === "{") depth++;
        else if (jsonText[i] === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
      }
      jsonText = endIdx > firstBrace ? jsonText.slice(firstBrace, endIdx + 1) : jsonText.slice(firstBrace);

      try { return JSON.parse(jsonText) as Record<string, unknown>; }
      catch { try { return JSON.parse(jsonText + "}") as Record<string, unknown>; } catch { return {}; } }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastRequest = { prompt };
      this.lastResponse = msg;
      return {};
    }
  }
}

export const toolRouter = new ToolRouter();
