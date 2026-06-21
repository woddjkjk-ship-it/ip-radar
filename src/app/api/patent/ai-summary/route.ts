/**
 * GET/POST /api/patent/ai-summary — 生成专利 AI 摘要
 *
 * GET 模式：?pn=CN117423077A → 自动查专利详情 → 调 LLM 生成摘要
 * POST 模式：Body { title, abstract, claimsText } → 直接调 LLM 生成摘要
 *
 * 调用 DeepSeek 生成 100-150 字中文概要。
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getChatLLM } from "@/lib/llm/router";
import { getProvider } from "@/lib/providers";

const PostSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().default(""),
  claimsText: z.string().default(""),
});

const GetSchema = z.object({
  pn: z.string().min(1),
});

/** 核心摘要生成逻辑 */
async function generateSummary(title: string, abstract: string, claimsText: string): Promise<string> {
  const prompt = `你是专利分析专家。请用 100-150 字中文概括以下专利的技术要点。

专利标题：${title}
摘要：${abstract || "无"}
独立权利要求：${claimsText || "无"}

要求：
- 一句话说明该专利解决什么问题
- 一句话说明核心技术方案
- 一句话说明与竞品的区别/优势
- 总计 100-150 字，不要超过 150 字
- 只返回摘要文本，不要任何前缀`;

  try {
    const chatLLM = getChatLLM();
    const result = await chatLLM.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 300 },
    );
    const text = result.content.trim();
    // DeepSeek 偶发返回空字符串（非异常），降级使用摘要
    if (!text) {
      console.warn("[ai-summary] LLM returned empty content, falling back to abstract");
      return abstract
        ? abstract.slice(0, 150) + "（注：AI 摘要生成异常，展示原始摘要）"
        : `专利"${title.slice(0, 50)}"的 AI 摘要暂无法生成，请查看专利详情。`;
    }
    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-summary] LLM call failed:", msg);
    // 降级：返回简单拼接
    if (abstract) return abstract.slice(0, 150);
    throw err;
  }
}

/** Mock 摘要生成（不调 LLM） */
function mockSummary(title: string, abstract: string): string {
  return abstract
    ? `【AI 摘要】本专利涉及${title.slice(0, 60)}技术领域。核心技术方案：${abstract.slice(0, 120)}...主要创新点在于通过优化的系统架构与方法实现性能提升。`
    : `【AI 摘要】专利"${title.slice(0, 50)}"涉及相关技术领域，具体方案请参阅专利全文。`;
}

/** 判断当前是否为 mock 模式 */
async function isMockMode(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const mode = cookieStore.get("data-mode")?.value;
    if (mode === "live") return false;
  } catch { /* 非请求上下文 */ }
  const envMode = process.env.DATA_MODE;
  return envMode !== "live";
}

// ── GET: 根据专利号生成摘要 ──

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = GetSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing pn parameter" }, { status: 400 });
  }

  const { pn } = parsed.data;

  try {
    const mock = await isMockMode();

    if (mock) {
      // Mock 模式：直接返回格式化文本
      return NextResponse.json({ summary: mockSummary(pn, "") });
    }

    // Live 模式：查专利详情 → 调 LLM
    const { provider } = await getProvider();
    // 先通过 P069 获取 patent_id
    const searchResult = await provider.searchByPn([pn], 1);
    if (searchResult.results.length === 0) {
      return NextResponse.json({ summary: `未找到专利 ${pn} 的信息` });
    }

    const patentId = searchResult.results[0].patentId;
    const detail = await provider.getDetail(patentId);

    // 检查专利数据是否完整（Live 模式下虚拟 PN 可能返回空数据）
    if (!detail.title && !detail.abstract) {
      return NextResponse.json({
        summary: `该专利号 (${pn}) 在 Live 模式下无法获取完整信息，AI 摘要不可用。可能原因：专利号为 Mock 虚拟数据，或该专利未收录著录项目。`,
      });
    }

    // 提取前 3 条独立权利要求的文本
    const indepClaims = detail.claims
      .filter((c) => c.isIndependent)
      .slice(0, 3)
      .map((c) => c.text)
      .join("；");

    const summary = await generateSummary(detail.title, detail.abstract ?? "", indepClaims);
    return NextResponse.json({ summary: summary || `专利 ${pn} 的 AI 摘要暂无法生成，请查看原始摘要。` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-summary] GET error:", msg);
    return NextResponse.json(
      { summary: `专利 ${pn} 的 AI 摘要生成失败：${msg}` },
      { status: 200 },
    );
  }
}

// ── POST: 根据 body 参数生成摘要 ──

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, abstract, claimsText } = parsed.data;

  try {
    const mock = await isMockMode();

    if (mock) {
      return NextResponse.json({ summary: mockSummary(title, abstract) });
    }

    const summary = await generateSummary(title, abstract, claimsText);
    return NextResponse.json({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ai-summary] POST error:", msg);
    // 降级返回
    if (abstract) {
      return NextResponse.json({ summary: abstract.slice(0, 150) });
    }
    return NextResponse.json(
      { summary: `专利"${title.slice(0, 50)}"的 AI 摘要暂时不可用` },
      { status: 200 },
    );
  }
}
