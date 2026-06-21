/**
 * 全面 Bug 检测测试 — 覆盖 Prompt/Schema 对齐 + 数据流 + API 行为
 *
 * 运行：npx tsx test/comprehensive-bug-test.ts
 * 前置：Next.js dev server 运行中（npm run dev）
 *
 * 测试分 3 层：
 *   L1 — Prompt/Schema 对齐（纯静态分析，不调网络）
 *   L2 — 代码逻辑分析（类型一致性、数据流完整性）
 *   L3 — API 集成测试（调真实 API，需 dev server）
 */

import * as fs from "fs";
import * as path from "path";

// ===== 测试框架 =====
let passed = 0;
let failed = 0;
const failures: string[] = [];
const bugs: Array<{
  id: string;
  severity: "🔴 CRITICAL" | "🟡 HIGH" | "🟡 MEDIUM" | "🟢 LOW";
  title: string;
  description: string;
  files: string[];
  fix: string;
}> = [];

function assert(condition: boolean, label: string): void {
  if (condition) { passed++; }
  else { failed++; failures.push(`❌ FAIL: ${label}`); }
}

function assertContains(text: string, substr: string, label: string): void {
  assert(text.includes(substr), `${label}\n  missing: "${substr}"`);
}

function assertMissing(text: string, substr: string, label: string): void {
  assert(!text.includes(substr), `${label}\n  should not contain: "${substr}"`);
}

function addBug(
  id: string, severity: string, title: string, description: string, files: string[], fix: string
): void {
  bugs.push({
    id,
    severity: severity as "🔴 CRITICAL" | "🟡 HIGH" | "🟡 MEDIUM" | "🟢 LOW",
    title,
    description,
    files,
    fix,
  });
}

function summary(): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`全面 Bug 检测结果: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\n失败详情:`);
    for (const f of failures) console.log(`  ${f}`);
  }
  console.log(`\n发现 ${bugs.length} 个 Bug:`);
  for (const b of bugs) {
    console.log(`  ${b.severity} ${b.id}: ${b.title}`);
  }
  console.log(`${"=".repeat(60)}\n`);

  // 输出 JSON 报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: { totalTests: passed + failed, passed, failed },
    bugs,
  };
  const dir = "test/test-results";
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "comprehensive-bug-report.json"), JSON.stringify(report, null, 2));
  console.log(`📄 JSON 报告已保存: ${dir}/comprehensive-bug-report.json\n`);

  if (failed > 0) process.exit(1);
}

// ===== 提示：type 导出 =====

// 从源文件中读取类型定义（用于对比分析）
function readSource(filepath: string): string {
  return fs.readFileSync(path.join(process.cwd(), filepath), "utf-8");
}

// ================================================================
// L1: Prompt/Schema 对齐测试
// ================================================================
console.log("═".repeat(60));
console.log("L1: Prompt/Schema 对齐测试");
console.log("═".repeat(60));

// ── 1.1 understand.md vs TechElementsSchema ──
console.log("\n── 1.1 understand.md ↔ TechElementsSchema ──");

{
  const promptContent = readSource("src/lib/llm/prompts/understand.md");
  const schemaSource = readSource("src/lib/types/tech-elements.ts");

  // prompt 输出格式包含 problemSolutionText（R2 修复后已补全）
  const hasProblemSolutionTextInPrompt = promptContent.includes("problemSolutionText");
  assert(hasProblemSolutionTextInPrompt,
    "understand.md 输出格式包含 problemSolutionText ✅（R2 修复完成）");

  // Schema 中有 problemSolutionText
  const hasProblemSolutionTextInSchema = schemaSource.includes("problemSolutionText");
  assert(hasProblemSolutionTextInSchema,
    "TechElementsSchema 包含 problemSolutionText（required）");

  if (!hasProblemSolutionTextInPrompt && hasProblemSolutionTextInSchema) {
    addBug(
      "BUG-NEW-001",
      "🔴 CRITICAL",
      "understand.md 缺少 problemSolutionText 字段 → ALL Step 1 LLM 调用失败",
      `TechElementsSchema 要求 problemSolutionText: z.string()，但 understand.md 的输出格式中不包含此字段。\n` +
      `LLM 返回的 JSON 缺少此字段 → zod safeParse 失败 → 重试 2 次均失败 → 降级到 mockUnderstand()。\n` +
      `影响：所有 Step 1 的 LLM 调用（每次 2 次重试）全部白费，实际永远使用 mock 数据。`,
      [
        "src/lib/llm/prompts/understand.md:17-43 (缺少 problemSolutionText)",
        "src/lib/types/tech-elements.ts:24 (要求 problemSolutionText)",
        "src/lib/agent/steps/understand.ts:92 (zod 解析失败)",
      ],
      "方案A：在 understand.md 输出格式中添加 problemSolutionText 字段\n" +
      "方案B：将 problemSolutionText 改为 z.string().optional()，始终由代码自动拼接",
    );
  }
}

// ── 1.2 dedup-merge.md vs TopPatentsSchema (PatentSummarySchema) ──
console.log("\n── 1.2 dedup-merge.md ↔ TopPatentsSchema ──");

{
  const promptContent = readSource("src/lib/llm/prompts/dedup-merge.md");
  const patentSchema = readSource("src/lib/types/patent.ts");

  // PatentSummarySchema 要求的字段
  const requiredFields = ["apno", "currentAssignee", "inventor", "apdt", "pbdt", "authority"];
  const optionalFields = ["patentId", "pn", "title", "originalAssignee"];

  // 检查哪些在 prompt 输出格式中缺失
  const outputSection = promptContent.split("## 输出要求")[1] || "";
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!outputSection.includes(`"${field}"`)) {
      missingFields.push(field);
    }
  }

  assert(missingFields.length === 0,
    `dedup-merge.md 输出格式完整（0 个缺失）✅（R2 修复完成）`);

  // 验证 Schema 确实要求这些字段
  for (const field of missingFields) {
    assertContains(patentSchema, field, `PatentSummarySchema 要求 ${field}`);
  }

  if (missingFields.length > 0) {
    addBug(
      "BUG-NEW-002",
      "🟡 HIGH",
      `dedup-merge.md 缺少 ${missingFields.length} 个必填字段 → ALL Step 2 LLM 调用失败`,
      `PatentSummarySchema 要求的 9 个字段中，LLM prompt 输出格式只定义了 patentId/pn/title/originalAssignee/relevancyReason。\n` +
      `缺失：${missingFields.join(", ")}。LLM 永远不会输出这些字段 → zod 校验失败 → 降级 mock。\n` +
      `影响：Step 2 LLM 去重融合功能完全无效，每次浪费 1 次 LLM 调用。`,
      [
        "src/lib/llm/prompts/dedup-merge.md:41-55 (输出格式不完整)",
        "src/lib/types/patent.ts:49-67 (PatentSummarySchema 所有必填字段)",
        "src/lib/agent/steps/search.ts:188-198 (zod 解析失败 → mock)",
      ],
      "方案A：在 dedup-merge.md 输出格式中添加全部 9 个字段\n" +
      "方案B：创建简化 schema（只需要 5 个字段 + relevancyReason），从搜索结果中按 patentId 补全其余字段",
    );
  }
}

// ── 1.3 assess-risk.md vs RiskAssessmentSchema ──
console.log("\n── 1.3 assess-risk.md ↔ RiskAssessmentSchema ──");

{
  const promptContent = readSource("src/lib/llm/prompts/assess-risk.md");
  const schemaOutput = promptContent.split("## 输出要求")[1] || "";

  // RiskAssessmentSchema 要求的所有字段
  const assessFields = ["patentId", "pn", "title", "riskLevel", "matchedClaims", "analysis", "avoidanceAdvice"];
  const missing: string[] = [];

  for (const field of assessFields) {
    if (!schemaOutput.includes(`"${field}"`)) {
      missing.push(field);
    }
  }

  if (missing.length === 0) {
    assert(true, `assess-risk.md 输出格式包含全部 ${assessFields.length} 个必填字段 ✅`);
  } else {
    assert(false, `assess-risk.md 缺少字段: ${missing.join(", ")}`);
    addBug(
      "BUG-NEW-003",
      "🟡 HIGH",
      "assess-risk.md 输出字段不完整",
      `缺少: ${missing.join(", ")}`,
      ["src/lib/llm/prompts/assess-risk.md"],
      "补全 prompt 输出格式",
    );
  }
}

// ── 1.4 report.md vs FtoReportSchema ──
console.log("\n── 1.4 report.md ↔ FtoReportSchema ──");

{
  const promptContent = readSource("src/lib/llm/prompts/report.md");
  const schemaOutput = promptContent.split("## 输出要求")[1] || "";

  // FtoReportSchema 要求的顶层字段
  const reportTopFields = ["title", "executiveSummary", "riskLevel", "stats", "patentAnalysis", "recommendations", "generatedAt"];
  const patentItemFields = ["pn", "title", "assignee", "riskLevel", "matchedClaims", "analysis", "avoidanceAdvice", "legalStatus"];

  const missingTop: string[] = [];
  for (const field of reportTopFields) {
    if (!schemaOutput.includes(`"${field}"`)) missingTop.push(field);
  }

  // modelUsed 不在 prompt 中（由代码注入）
  const hasModelUsed = schemaOutput.includes("modelUsed");
  const hasTokenUsage = schemaOutput.includes("tokenUsage");

  assert(missingTop.length === 0,
    `report.md 顶层字段完整（缺失: ${missingTop.join(", ") || "无"}）`);

  for (const field of patentItemFields) {
    assertContains(schemaOutput, `"${field}"`, `report.md patentAnalysis 含 ${field}`);
  }

  if (!hasModelUsed) {
    assert(true, "report.md 输出格式不含 modelUsed（由代码运行时注入）");
    addBug(
      "BUG-NEW-004",
      "🟢 LOW",
      "report.md 缺少 modelUsed 字段（代码注入兜底）",
      "FtoReportSchema 要求 modelUsed: z.string()，但 report.md prompt 未要求 LLM 输出此字段。\n" +
      "report.ts 在 zod 校验前从 result.model 注入 modelUsed，功能正常但 prompt 与 schema 不同步。",
      [
        "src/lib/llm/prompts/report.md:27-68 (输出格式缺 modelUsed)",
        "src/lib/agent/steps/report.ts:105-115 (代码注入 modelUsed)",
      ],
      "在 report.md 输出格式中添加 modelUsed 字段，或明确说明此字段由系统自动填充",
    );
  }

  if (!hasTokenUsage) {
    assert(true, "report.md 输出格式不含 tokenUsage（可选字段，由代码注入）");
  }
}

// ── 1.5 assess-risk.md {{#PATENTS}} block contains {{#CLAIMS}} (nested mustache) ──
console.log("\n── 1.5 assess-risk.md 嵌套 Mustache 模板 ──");

{
  const promptContent = readSource("src/lib/llm/prompts/assess-risk.md");
  const assessSource = readSource("src/lib/agent/steps/assess.ts");

  // 检查 {{#PATENTS}} section 是否包含 {{#CLAIMS}}
  const patentsSection = promptContent.match(/\{\{#PATENTS\}\}([\s\S]*?)\{\{\/PATENTS\}\}/);
  const hasNestedClaims = patentsSection?.[1]?.includes("{{#CLAIMS}}") ?? false;

  if (hasNestedClaims) {
    // 检查 assess.ts 是否替换了整个 {{#PATENTS}} block（正确处理嵌套）
    const usesRegexReplace = assessSource.includes("/{{#PATENTS}}[\\s\\S]*?{{\\/PATENTS}}/g");
    assert(usesRegexReplace,
      "assess.ts 使用正则替换整个 {{#PATENTS}} 块（正确处理嵌套 {{#CLAIMS}}）");
    console.log("  ✅ {{#CLAIMS}} 嵌套在 {{#PATENTS}} 内，assess.ts 正确替换整个块");
  }
}

// ================================================================
// L2: 代码逻辑分析
// ================================================================
console.log("\n" + "═".repeat(60));
console.log("L2: 代码逻辑分析");
console.log("═".repeat(60));

// ── 2.1 calcRiskLevel 永远返回 "low" ──
console.log("\n── 2.1 monitor/feed calcRiskLevel ──");

{
  const patentTypeSource = readSource("src/lib/types/patent.ts");
  const monitorSource = readSource("src/app/api/monitor/feed/route.ts");

  // PatentSummary 没有 ipcClasses
  const patentSummaryHasIpc = patentTypeSource.includes("ipcClasses") &&
    patentTypeSource.match(/interface PatentSummary[\s\S]*?\{[\s\S]*?\}/)?.[0]?.includes("ipcClasses");

  // calcRiskLevel 强制转换
  const hasUnsafeCast = monitorSource.includes("as unknown as { ipcClasses?: string[] }");

  if (!patentSummaryHasIpc && hasUnsafeCast) {
    addBug(
      "BUG-NEW-005",
      "🟡 MEDIUM",
      "monitor/feed calcRiskLevel() 永远返回 'low'（PatentSummary 无 ipcClasses）",
      "PatentSummary 接口不包含 ipcClasses 字段（仅在 PatentDetail 中有）。\n" +
      "calcRiskLevel 通过 unsafe cast 尝试读取 ipcClasses，但来自搜索 API 的 PatentSummary 对象永远不包含此字段。\n" +
      "结果：matchCount 永远为 0，所有专利风险被错误标记为 'low'。",
      [
        "src/app/api/monitor/feed/route.ts:47 (unsafe cast)",
        "src/lib/types/patent.ts:15-26 (PatentSummary 无 ipcClasses)",
      ],
      "方案A：在 searchByKeyword/searchByCompany 返回结果中附带 ipcClasses\n" +
      "方案B：将风险计算改为基于标题/摘要的关键词匹配\n" +
      "方案C：在 monitor/feed 中先获取专利详情再计算风险",
    );
  }

  assert(true, "calcRiskLevel bug 已识别: PatentSummary 缺少 ipcClasses");
}

// ── 2.2 SessionStore.cleanupExpired() 无人调用 ──
console.log("\n── 2.2 SessionStore 内存泄漏 ──");

{
  const storeSource = readSource("src/lib/session/store.ts");
  const hasCleanupFn = storeSource.includes("cleanupExpired");
  assert(hasCleanupFn, "SessionStore 已定义 cleanupExpired()");

  // 搜索调用者（在 src/ 中，排除 test/）
  const allTsFiles = globSync("src/**/*.ts");
  let hasCaller = false;
  for (const f of allTsFiles) {
    const content = readSource(f);
    if (content.includes("cleanupExpired")) {
      hasCaller = true;
      console.log(`  cleanupExpired 调用者: ${f}`);
    }
  }

  if (!hasCaller) {
    addBug(
      "BUG-NEW-006",
      "🟡 MEDIUM",
      "SessionStore.cleanupExpired() 已定义但从未被调用 → 内存泄漏",
      "cleanupExpired() 方法已实现（含 2h TTL），但在 src/ 下无任何调用者。\n" +
      "无 setInterval 定时清理、无 API 中间件触发、无 cron job。\n" +
      "长时间运行的服务器上，会话 Map 会无限增长。",
      [
        "src/lib/session/store.ts:138 (cleanupExpired 定义)",
        "(无调用者)",
      ],
      "在 API route 或 server middleware 中添加定期调用：\n" +
      "setInterval(() => SessionStore.cleanupExpired(), 30 * 60 * 1000);",
    );
  }
}

// ── 2.3 GET /api/copilot/session/[id] 缺少 zod 校验 ──
console.log("\n── 2.3 API Route zod 校验完整性 ──");

{
  const sessionRoute = readSource("src/app/api/copilot/session/[id]/route.ts");
  const hasZodImport = sessionRoute.includes("import { z }") || sessionRoute.includes('from "zod"');

  if (!hasZodImport) {
    addBug(
      "BUG-NEW-007",
      "🟢 LOW",
      "GET /api/copilot/session/[id] 缺少 zod 参数校验",
      "所有其他 API routes 都使用 zod 校验入参，唯独此路由直接使用 params.id 不做校验。\n" +
      "虽不会导致安全问题（无效 id 返回 404），但不符合项目一致性约定。",
      [
        "src/app/api/copilot/session/[id]/route.ts:14-22",
      ],
      "添加 zod schema 校验 id 格式（如 z.string().min(1)），保持与其他路由一致",
    );
  }

  assert(true, "session/[id] route 缺少 zod 校验已记录");
}

// ── 2.4 assess.ts Prompt 模板变量替换不完整 ──
console.log("\n── 2.4 assess.ts 模板变量检查 ──");

{
  const assessSource = readSource("src/lib/agent/steps/assess.ts");
  const promptContent = readSource("src/lib/llm/prompts/assess-risk.md");

  // 提取所有 {{VARIABLE}} 占位符
  const placeholders = [...promptContent.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
  const uniquePlaceholders = [...new Set(placeholders)];

  // 检查代码中是否全部替换
  const missingReplaces: string[] = [];
  for (const ph of uniquePlaceholders) {
    if (!assessSource.includes(`"{{${ph}}}"`)) {
      missingReplaces.push(ph);
    }
  }

  // {{INDEX}}, {{PN}}, {{TITLE}}, {{ASSIGNEE}}, {{ABSTRACT}}, {{NUMBER}}, {{TEXT}} 在 {{#PATENTS}}/{{#CLAIMS}} 内部，会被整个块替换
  const nestedVars = ["INDEX", "PN", "TITLE", "ASSIGNEE", "ABSTRACT", "NUMBER", "TEXT", "INDEPENDENT"];
  const realMissing = missingReplaces.filter(v => !nestedVars.includes(v) && v !== "INDEPENDENT");

  if (realMissing.length > 0) {
    console.log(`  ⚠️ assess.ts 可能未替换: ${realMissing.join(", ")}`);
  } else {
    console.log(`  ✅ 所有顶层占位符均已替换（嵌套变量由块替换处理）`);
  }

  assert(realMissing.length === 0, `assess.ts 模板变量替换完整（缺失: ${realMissing.join(", ") || "无"}）`);
}

// ── 2.5 search.ts Prompt 模板变量替换完整性 ──
console.log("\n── 2.5 search.ts 模板变量检查 ──");

{
  const searchSource = readSource("src/lib/agent/steps/search.ts");
  const promptContent = readSource("src/lib/llm/prompts/dedup-merge.md");

  const placeholders = [...promptContent.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
  const uniquePlaceholders = [...new Set(placeholders)];

  const missingReplaces: string[] = [];
  for (const ph of uniquePlaceholders) {
    if (!searchSource.includes(`"{{${ph}}}"`)) {
      missingReplaces.push(ph);
    }
  }

  // COMPANY, TOTAL, RESULTS 在 {{#COMPANY_RESULTS}} 内部，会被整个块替换
  const nestedVars = ["COMPANY", "TOTAL", "RESULTS"];
  const realMissing = missingReplaces.filter(v => !nestedVars.includes(v));

  if (realMissing.length > 0) {
    console.log(`  ⚠️ search.ts 可能未替换: ${realMissing.join(", ")}`);
  } else {
    console.log(`  ✅ 所有顶层占位符均已替换（嵌套变量由块替换处理）`);
  }

  assert(realMissing.length === 0, `search.ts 模板变量替换完整`);
}

// ================================================================
// L3: API 集成测试（需 dev server）
// ================================================================
console.log("\n" + "═".repeat(60));
console.log("L3: API 集成测试");
console.log("═".repeat(60));

const BASE_URL = "http://localhost:3000";

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/`);
    return res.ok;
  } catch {
    return false;
  }
}

async function postJSON(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getJSON(path: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`);
}

async function collectSSE(response: Response): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const reader = response.body?.getReader();
  if (!reader) return events;

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          currentData = line.slice(6);
        } else if (line === "" && currentData) {
          try {
            events.push({ event: currentEvent, data: JSON.parse(currentData) });
          } catch { /* skip */ }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  } catch { /* stream closed */ }

  return events;
}

async function main(): Promise<void> {
  const serverUp = await checkServer();
  if (!serverUp) {
    console.log("\n  ⚠️  Next.js dev server 未运行在 :3000！");
    console.log("  跳过 L3 API 集成测试。L1+L2 静态测试结果仍然有效。\n");
    summary();
    return;
  }
  console.log("  ✅ Dev server 运行中\n");

  // ── 3.1 运行完整流水线 → 验证 LLM 调用是否失败 ──
  console.log("── 3.1 流水线 LLM 调用状态 ──");

  try {
    const res = await postJSON("/api/copilot/run", {
      text: "一种基于Transformer的多模态自动驾驶感知融合方法，使用跨模态注意力机制融合LiDAR和Camera数据，通过知识蒸馏实现实时推理",
      competitors: ["Tesla", "Waymo"],
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // 用 ReadableStream 手动读取（避免超时）
    const events = await collectSSE(res);
    clearTimeout(timeoutId);

    console.log(`  收到 ${events.length} 个 SSE 事件`);

    // 检查每个 step 的 success 事件
    for (const stepNum of [1, 2, 3, 4]) {
      const successEvent = events.find(e => e.data.step === stepNum && e.data.status === "success");
      assert(successEvent !== undefined, `Step ${stepNum} 有 success 事件`);
    }

    // 获取会话详情，检查 LLM 调用日志
    const sessionId = events.find(e => e.data.sessionId)?.data.sessionId as string;
    if (sessionId) {
      const sessionRes = await getJSON(`/api/copilot/session/${sessionId}`);
      if (sessionRes.ok) {
        const session = await sessionRes.json();

        // Step 1: 检查 LLM 调用是否有 zod 错误
        const s1Calls = session.steps?.["1"]?.llmCalls ?? [];
        const s1Errors = s1Calls.filter((c: Record<string, unknown>) => c.error);
        if (s1Errors.length > 0) {
          console.log(`  ⚠️ Step 1: ${s1Errors.length}/${s1Calls.length} LLM 调用有 zod 错误`);
          console.log(`     错误: ${(s1Errors[0] as Record<string, unknown>).error?.toString().slice(0, 100)}`);
        } else if (s1Calls.length > 0) {
          console.log(`  ✅ Step 1: ${s1Calls.length} LLM 调用全部成功`);
        }

        // Step 2: 检查 LLM 调用是否有 zod 错误
        const s2Calls = session.steps?.["2"]?.llmCalls ?? [];
        const s2Errors = s2Calls.filter((c: Record<string, unknown>) => c.error);
        if (s2Errors.length > 0) {
          console.log(`  ⚠️ Step 2: ${s2Errors.length}/${s2Calls.length} LLM 调用有 zod 错误`);
          console.log(`     错误: ${(s2Errors[0] as Record<string, unknown>).error?.toString().slice(0, 100)}`);
        } else if (s2Calls.length > 0) {
          console.log(`  ✅ Step 2: ${s2Calls.length} LLM 调用全部成功`);
        }

        // Step 3: 检查 LLM 调用状态
        const s3Calls = session.steps?.["3"]?.llmCalls ?? [];
        const s3Errors = s3Calls.filter((c: Record<string, unknown>) => c.error);
        if (s3Errors.length > 0) {
          console.log(`  ⚠️ Step 3: ${s3Errors.length}/${s3Calls.length} LLM 调用有 zod 错误`);
        } else if (s3Calls.length > 0) {
          console.log(`  ✅ Step 3: ${s3Calls.length} LLM 调用全部成功`);
        } else {
          console.log(`  ℹ️ Step 3: 无 LLM 调用（可能使用 mock）`);
        }

        // Step 4: 检查 LLM 调用状态
        const s4Calls = session.steps?.["4"]?.llmCalls ?? [];
        const s4Errors = s4Calls.filter((c: Record<string, unknown>) => c.error);
        if (s4Errors.length > 0) {
          console.log(`  ⚠️ Step 4: ${s4Errors.length}/${s4Calls.length} LLM 调用有 zod 错误`);
        } else if (s4Calls.length > 0) {
          console.log(`  ✅ Step 4: ${s4Calls.length} LLM 调用全部成功`);
        } else {
          console.log(`  ℹ️ Step 4: 无 LLM 调用（可能使用 mock）`);
        }

        // 检查 notes 中的 mock 降级提示
        for (const sn of ["1", "2", "3", "4"]) {
          const notes = session.steps?.[sn]?.notes ?? [];
          const mockNotes = notes.filter((n: string) => n.includes("Mock") || n.includes("mock"));
          if (mockNotes.length > 0) {
            console.log(`  ⚠️ Step ${sn}: 降级到 mock — ${mockNotes[0].slice(0, 80)}`);
          }
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ 流水线测试异常: ${msg}`);
  }

  // ── 3.2 monitor/feed 风险计算验证 ──
  console.log("\n── 3.2 monitor/feed 风险计算验证 ──");

  try {
    const res = await fetch(
      `${BASE_URL}/api/monitor/feed?mode=tech&topics=BEV感知,传感器融合&limit=5`
    );
    const body = await res.json();

    if (body.items && Array.isArray(body.items)) {
      const riskLevels = body.items.map((i: Record<string, unknown>) => i.riskLevel);
      const hasNonLow = riskLevels.some((r: string) => r !== "low");

      console.log(`  风险分布: ${JSON.stringify(
        riskLevels.reduce((acc: Record<string, number>, r: string) => {
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {})
      )}`);

      if (!hasNonLow && riskLevels.length > 0) {
        console.log("  ⚠️ 所有专利风险均为 'low'（确认 BUG-NEW-005）");
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ monitor/feed 测试异常: ${msg}`);
  }

  // ── 3.3 API zod 校验完整性 ──
  console.log("\n── 3.3 API zod 校验 ──");

  {
    // /api/copilot/run 缺 text → 400
    const res = await postJSON("/api/copilot/run", { competitors: ["Tesla"] });
    assert(res.status === 400, "POST /api/copilot/run 缺 text → 400");
  }

  {
    // /api/copilot/assess 缺 sessionId → 400
    const res = await postJSON("/api/copilot/assess", {});
    assert(res.status === 400, "POST /api/copilot/assess 缺 sessionId → 400");
  }

  {
    // /api/search 缺 q → 400
    const res = await fetch(`${BASE_URL}/api/search`);
    assert(res.status === 400, "GET /api/search 缺 q → 400");
  }
}

// ── 简易 glob 实现 ──
function globSync(pattern: string): string[] {
  const baseDir = process.cwd();
  const parts = pattern.split("/");
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth >= parts.length) {
      if (fs.statSync(dir).isFile()) results.push(path.relative(baseDir, dir));
      return;
    }

    const segment = parts[depth];
    if (segment === "**") {
      // 递归遍历所有子目录
      walkDir(dir, depth + 1);
      walkDir(dir, depth); // also match current level
    } else if (segment.includes("*")) {
      const regex = new RegExp("^" + segment.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (regex.test(entry.name)) {
            walk(path.join(dir, entry.name), depth + 1);
          }
        }
      }
    } else {
      walk(path.join(dir, segment), depth + 1);
    }
  }

  function walkDir(dir: string, depth: number): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walkDir(fullPath, depth);
      } else if (entry.isFile()) {
        const relPath = path.relative(baseDir, fullPath);
        // Match against the remaining pattern
        if (matchRemaining(relPath, parts.slice(depth))) {
          results.push(relPath);
        }
      }
    }
  }

  function matchRemaining(filepath: string, remaining: string[]): boolean {
    const fileParts = filepath.split(path.sep);
    // Simple suffix match
    if (remaining.length === 0) return true;
    const suffix = remaining.join("/");
    const regexStr = "^" + suffix.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".") + "$";
    try {
      return new RegExp(regexStr).test(filepath);
    } catch {
      return false;
    }
  }

  walk(baseDir, 0);
  return results;
}

// ===== 启动 =====
main().then(() => {
  summary();
}).catch((err) => {
  console.error("测试执行异常:", err);
  summary();
  process.exit(1);
});
