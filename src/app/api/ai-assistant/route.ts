/**
 * POST /api/ai-assistant — AI 助手代理（服务端执行 Skill，保护 API Key）
 *
 * Body: { skillName: string, userInput: string }
 * 响应: { success: boolean, action?: SkillAction, logs?: SkillLogEntry[] }
 *
 * Skill 在服务端执行 → 可访问 process.env.DEEPSEEK_API_KEY → 调用真实 DeepSeek。
 * 日志返回给客户端，由客户端写入 LogStore 显示在右下角活动日志中。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toolRouter } from "@/lib/tools/router";
import { executeSmartPatentSearch } from "@/lib/tools/skills/smart-patent-search";
import { executeTechResearchPlanner } from "@/lib/tools/skills/tech-research-planner";
import { executeMonitorConfigurator } from "@/lib/tools/skills/monitor-configurator";

const BodySchema = z.object({
  skillName: z.enum(["smart_patent_search", "tech_research_planner", "monitor_configurator"]),
  userInput: z.string().min(1),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { skillName, userInput } = parsed.data;

  try {
    // 静态导入 Skill（避免动态 import 缓存旧模块）
    // SkillInput 要求 provider，但 Skill 实际只用 userInput（不调 Patsnap API），传空对象即可
    const skillInput = { userInput, provider: {} as unknown as import("@/lib/providers").PatentDataProvider };
    let result: { success: boolean; action: unknown; fallbackInput?: string };

    if (skillName === "smart_patent_search") {
      result = await executeSmartPatentSearch(skillInput);
    } else if (skillName === "tech_research_planner") {
      result = await executeTechResearchPlanner(skillInput);
    } else {
      result = await executeMonitorConfigurator(skillInput);
    }

    // 附加 toolRouter 的原始 LLM 响应（供前端日志展示）
    const enriched = {
      ...result,
      rawResponse: (toolRouter as { lastResponse?: unknown }).lastResponse,
    };
    return NextResponse.json(enriched);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-assistant] Skill execution error:", msg);
    return NextResponse.json(
      { success: false, error: msg, action: null },
      { status: 500 },
    );
  }
}