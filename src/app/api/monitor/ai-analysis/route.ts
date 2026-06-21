/**
 * POST /api/monitor/ai-analysis — 生成监控订阅 AI 风险分析
 *
 * Body: { subscriptionId, name, query, companies, newPatentTitles }
 * 缓存到 localStorage: monitor-ai-analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getChatLLM } from "@/lib/llm/router";

const RequestSchema = z.object({
  subscriptionId: z.string(),
  name: z.string(),
  query: z.string(),
  companies: z.array(z.string()).optional(),
  newPatentTitles: z.array(z.string()),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, query, companies, newPatentTitles } = parsed.data;

  const prompt =
    `你是专利风险分析师。请针对以下监控订阅生成 50-80 字的简短分析报告。

监控名称：${name}
监控查询：${query}
关注企业：${companies?.join("、") ?? "不限"}
最近新增专利标题（前 10 条）：
${newPatentTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join("\n")}

请分析：
- 竞品近期技术动向（1-2 句）
- 是否存在潜在风险信号（1 句）
- 建议下一步行动（1 句）

总计 50-80 字，只返回分析文本。`;

  try {
    const chatLLM = getChatLLM();
    const result = await chatLLM.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.4, maxTokens: 400 },
    );

    return NextResponse.json({ analysis: result.content.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        analysis: `近期在"${query}"方向监测到 ${newPatentTitles.length} 件新专利，建议关注 ${companies?.[0] ?? "主要申请人"} 的动态。`,
        fallback: true,
        error: msg,
      },
      { status: 200 },
    );
  }
}
