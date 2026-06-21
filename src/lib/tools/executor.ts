/**
 * Executor — Tool 执行引擎
 *
 * 根据 Router 返回的 ToolCall，查找注册表中对应的 Tool 并执行。
 * 每次执行自动写入 LogStore，供 ActivityLog 展示。
 */

import type { PatentDataProvider } from "@/lib/providers/types";
import type { ToolCall, ToolResult } from "@/lib/tools/types";
import { getTool } from "@/lib/tools/registry";
import { logStore } from "@/lib/log-store";

/**
 * 执行单个 ToolCall。
 * 自动校验 inputSchema → 调用 execute → 写入 LogStore。
 */
export async function executeToolCall(
  call: ToolCall,
  provider: PatentDataProvider,
): Promise<ToolResult> {
  const tool = getTool(call.name);
  if (!tool) {
    const result: ToolResult = { success: false, data: null, summary: `Tool not found: ${call.name}` };
    logStore.append({
      type: "api",
      title: `❌ ${call.name}`,
      action: result.summary,
      params: JSON.stringify(call.arguments),
      fullRequest: call.arguments,
      fullResponse: null,
    });
    return result;
  }

  // 校验输入
  const validateResult = tool.inputSchema.safeParse(call.arguments);
  if (!validateResult.success) {
    const result: ToolResult = {
      success: false,
      data: null,
      summary: `参数校验失败: ${validateResult.error.message}`,
    };
    logStore.append({
      type: "api",
      title: `❌ ${tool.displayName}`,
      action: result.summary,
      params: JSON.stringify(call.arguments),
      fullRequest: call.arguments,
      fullResponse: validateResult.error,
    });
    return result;
  }

  // 执行
  try {
    const result = await tool.execute(validateResult.data, provider);
    logStore.append({
      type: "api",
      title: `🔷 ${tool.displayName}`,
      action: result.summary,
      params: JSON.stringify(call.arguments),
      result: result.summary,
      fullRequest: call.arguments,
      fullResponse: result.data,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStore.append({
      type: "api",
      title: `❌ ${tool.displayName}`,
      action: `执行失败: ${msg}`,
      params: JSON.stringify(call.arguments),
      fullResponse: { error: msg },
    });
    return { success: false, data: null, summary: msg };
  }
}
