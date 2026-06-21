/**
 * Step 1: 技术理解 — 提取技术要素 + HITL 用户微调
 *
 * 流程：
 * 1. 如果有架构图 → VisionLLM 描述 → 拼入 prompt
 * 2. DeepSeek 提取 TechElements（含 keywords/IPC/competitors）
 * 3. 返回要素供前端 HITL 编辑器展示，用户可修改后确认
 *
 * zod 校验 LLM 输出，失败重试 1 次。
 * LLM 不可用时（Mock 模式）使用硬编码 mock 响应。
 */

import { z } from "zod";
import { TechElementsSchema } from "@/lib/types";
import { SessionStore } from "@/lib/session/store";
import type { CopilotSession } from "@/lib/session/types";
import type { StepUpdate } from "@/lib/agent/stream";
import type { ChatLLM, VisionLLM } from "@/lib/llm/types";
import { getChatLLM, getVisionLLM } from "@/lib/llm/router";
import { mockUnderstand } from "@/lib/agent/mock-responses";
import { readFileSync } from "fs";
import { join } from "path";

/** 加载 prompt 模板 */
function loadPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "src/lib/llm/prompts", name), "utf-8");
}

/** Step 1 输出 schema（严格匹配 TechElementsSchema） */
const UnderstandOutputSchema = TechElementsSchema;

/**
 * 执行 Step 1：技术理解
 *
 * @param session - 当前会话
 * @param confirmedElements - 用户确认/修改后的要素（HITL）。若提供则跳过 LLM 调用，直接使用。
 */
export async function* stepUnderstand(
  session: CopilotSession,
  confirmedElements?: z.infer<typeof TechElementsSchema>,
): AsyncGenerator<StepUpdate> {
  const step = 1 as const;
  const name = "技术理解";

  // 如果用户已确认要素（HITL 回调），跳过 LLM
  if (confirmedElements) {
    SessionStore.setStepInput(session.id, step, { confirmedByUser: true });
    SessionStore.setStepOutput(session.id, step, { elements: confirmedElements, modified: true });
    SessionStore.appendNote(session.id, step, "用户手动确认/修改技术要素");

    yield {
      sessionId: session.id,
      step,
      status: "success",
      name,
      output: { elements: confirmedElements, modified: true },
      stepRecord: session.steps[step],
    };
    SessionStore.setStepStatus(session.id, step, "success");
    return;
  }

  SessionStore.setStepStatus(session.id, step, "running");
  SessionStore.setStepInput(session.id, step, { text: session.userInput.text, imageRef: session.userInput.imageRef });

  yield { sessionId: session.id, step, status: "running", name };

  // 如果有架构图，走 VisionLLM 描述
  let imageDescription = "";
  if (session.userInput.imageRef) {
    try {
      const visionLLM = getVisionLLM();
      const result = await visionLLM.describe(
        { url: session.userInput.imageRef },
        { style: "technical-architecture" },
      );
      imageDescription = result.description;
      SessionStore.appendLlmCall(session.id, step, {
        model: result.model,
        provider: "qwen-vl",
        role: "vision",
        promptMessages: [{ role: "user", content: `[image: ${session.userInput.imageRef}]` }],
        rawResponse: result.description,
        usage: result.usage,
        latencyMs: result.latencyMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      SessionStore.appendNote(session.id, step, `VisionLLM 调用失败，跳过架构图分析: ${msg}`);
    }
  }

  // 加载 prompt 模板并填入变量
  let prompt = loadPrompt("understand.md");
  // 截断过长的用户输入，防止超出 LLM context window
  const MAX_INPUT_CHARS = 3000;
  const truncatedText = session.userInput.text.length > MAX_INPUT_CHARS
    ? session.userInput.text.slice(0, MAX_INPUT_CHARS) + "\n…（方案文本过长，已截断）"
    : session.userInput.text;
  prompt = prompt.replace("{{TECH_DESCRIPTION}}", truncatedText);
  prompt = prompt.replace("{{COMPETITORS}}", session.competitors.join(" / "));
  if (imageDescription) {
    prompt = prompt.replace(
      "{{#IMAGE_DESCRIPTION}}",
      "",
    ).replace(
      "{{/IMAGE_DESCRIPTION}}",
      "",
    ).replace("{{IMAGE_DESCRIPTION}}", imageDescription);
  } else {
    // 移除图片描述占位块
    prompt = prompt.replace(/{{#IMAGE_DESCRIPTION}}[\s\S]*?{{\/IMAGE_DESCRIPTION}}/g, "");
  }

  // 调用 LLM 提取要素（含重试）
  let elements: z.infer<typeof TechElementsSchema> | null = null;
  let lastError: string | undefined;
  const maxRetries = 2;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const chatLLM = getChatLLM();
      const result = await chatLLM.chat(
        [{ role: "user", content: prompt }],
        { responseFormat: "json_object", temperature: 0.3 },
      );

      // zod 解析
      const parsed = JSON.parse(result.content);
      const validated = UnderstandOutputSchema.safeParse(parsed);

      // 记录 LLM 调用日志
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
        elements = validated.data;
        break;
      }

      if (attempt < maxRetries - 1) {
        // 重试：追加错误提示到 prompt
        prompt += `\n\n[Previous response was invalid JSON. Error: ${validated.error.message}. Please try again with valid JSON only.]`;
      } else {
        lastError = `LLM 输出格式校验失败（已重试 ${maxRetries} 次）: ${validated.error.message}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries - 1) {
        SessionStore.appendNote(session.id, step, `LLM 调用失败，重试中: ${msg}`);
      } else {
        lastError = msg;
      }
    }
  }

  // 降级：LLM 不可用时使用 mock 响应
  if (!elements) {
    SessionStore.appendNote(session.id, step, `LLM 调用失败，使用 Mock 响应: ${lastError}`);
    elements = mockUnderstand(session.userInput.text, session.competitors);
  }

  // 生成 problemSolutionText（用于语义检索）
  if (!elements.problemSolutionText || elements.problemSolutionText.trim() === "") {
    elements.problemSolutionText = `${elements.problem}\n${elements.solution}\n${elements.novelty}`;
  }

  SessionStore.setStepOutput(session.id, step, { elements, modified: false });
  SessionStore.setStepStatus(session.id, step, "success");

  yield {
    sessionId: session.id,
    step,
    status: "success",
    name,
    output: { elements, modified: false },
    stepRecord: session.steps[step],
  };
}
