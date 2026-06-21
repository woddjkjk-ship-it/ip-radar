/**
 * L1+L2 静态 Bug 检测（纯文件分析，不调 API，不调 LLM）
 *
 * 运行：npx tsx test/static-bug-check.ts
 */

import * as fs from "fs";
import * as path from "path";

let passed = 0;
let failed = 0;
const failures: string[] = [];
const bugs: Array<{
  id: string; severity: string; title: string; description: string; files: string[]; fix: string;
}> = [];

function assert(condition: boolean, label: string): void {
  if (condition) { passed++; } else { failed++; failures.push(`❌ ${label}`); }
}
function assertContains(text: string, substr: string, label: string): void {
  assert(text.includes(substr), `${label}\n  missing: "${substr}"`);
}
function addBug(id: string, sev: string, title: string, desc: string, files: string[], fix: string): void {
  bugs.push({ id, severity: sev, title, description: desc, files, fix });
}

const SRC = (p: string) => path.join(process.cwd(), p);
function read(p: string) { return fs.readFileSync(SRC(p), "utf-8"); }

console.log("═".repeat(60));
console.log("L1: Prompt ↔ Schema 对齐校验");
console.log("═".repeat(60));

// ========== BUG-NEW-001: understand.md 缺 problemSolutionText ==========
{
  const prompt = read("src/lib/llm/prompts/understand.md");
  const schema = read("src/lib/types/tech-elements.ts");

  const inPrompt = prompt.includes("problemSolutionText");
  const inSchema = schema.includes("problemSolutionText");

  if (!inPrompt && inSchema) {
    failed++; failures.push("❌ BUG-NEW-001: understand.md 缺少 problemSolutionText");
    addBug("BUG-NEW-001", "🔴 CRITICAL",
      "understand.md 缺少 problemSolutionText → ALL Step 1 LLM 调用失败",
      `TechElementsSchema 要求 problemSolutionText: z.string()（必填），但 understand.md 输出格式不含此字段。\n` +
      `LLM 返回 JSON 缺少该字段 → zod safeParse 失败 → 2 次重试均失败 → 降级 mock。\n` +
      `实测：每次调用耗时 ~10-25s，消耗 ~500-1500 tokens，全部浪费。`,
      ["src/lib/llm/prompts/understand.md:17-43", "src/lib/types/tech-elements.ts:24"],
      "方案A：在 understand.md 输出格式添加 problemSolutionText\n方案B：problemSolutionText 改为 z.string().optional()，代码自动拼接");
  } else {
    passed++;
  }
}

// ========== BUG-NEW-002: dedup-merge.md 缺 6 个必填字段 ==========
{
  const prompt = read("src/lib/llm/prompts/dedup-merge.md");
  const outputSection = prompt.split("## 输出要求")[1] || "";

  const requiredFields = ["apno", "currentAssignee", "inventor", "apdt", "pbdt", "authority"];
  const missing = requiredFields.filter(f => !outputSection.includes(`"${f}"`));

  if (missing.length > 0) {
    failed++; failures.push(`❌ BUG-NEW-002: dedup-merge.md 缺少 ${missing.length} 个字段: ${missing.join(", ")}`);
    addBug("BUG-NEW-002", "🟡 HIGH",
      `dedup-merge.md 缺少 ${missing.length} 个 PatentSummarySchema 必填字段 → ALL Step 2 LLM 调用失败`,
      `PatentSummarySchema 要求 9 个字段：patentId, pn, apno, title, originalAssignee, currentAssignee, inventor, apdt, pbdt, authority。\n` +
      `但 dedup-merge.md 只要求输出 patentId, pn, title, originalAssignee, relevancyReason。\n` +
      `缺失：${missing.join(", ")}。LLM 不输出这些字段 → zod 校验失败 → 降级 mock。`,
      ["src/lib/llm/prompts/dedup-merge.md:41-55", "src/lib/types/patent.ts:49-67"],
      "方案A：补全 9 个字段到 prompt\n方案B：创建简化 schema（5 字段 + relevancyReason），从搜索结果补全");
  } else {
    passed++;
  }
}

// ========== BUG-NEW-003: assess-risk.md 格式完整性 ==========
{
  const prompt = read("src/lib/llm/prompts/assess-risk.md");
  const outputSection = prompt.split("## 输出要求")[1] || "";

  const fields = ["patentId", "pn", "title", "riskLevel", "matchedClaims", "analysis", "avoidanceAdvice"];
  const missing = fields.filter(f => !outputSection.includes(`"${f}"`));

  if (missing.length === 0) {
    passed++; console.log("  ✅ assess-risk.md 输出格式完整（7/7 字段）");
  } else {
    failed++; failures.push(`❌ BUG-NEW-003: assess-risk.md 缺少字段: ${missing.join(", ")}`);
    addBug("BUG-NEW-003", "🟡 HIGH", "assess-risk.md 输出字段不完整",
      `缺少: ${missing.join(", ")}`, ["src/lib/llm/prompts/assess-risk.md:33-50"], "补全字段");
  }
}

// ========== BUG-NEW-004: report.md 缺 modelUsed ==========
{
  const prompt = read("src/lib/llm/prompts/report.md");
  const outputSection = prompt.split("## 输出要求")[1] || "";
  const hasModelUsed = outputSection.includes("modelUsed");

  if (!hasModelUsed) {
    passed++; console.log("  ⚠️ report.md 不含 modelUsed（由代码注入，功能正常但 prompt 不同步）");
    addBug("BUG-NEW-004", "🟢 LOW",
      "report.md 缺少 modelUsed 字段（代码注入兜底）",
      "FtoReportSchema 要求 modelUsed: z.string()，但 report.md 不要求 LLM 输出。\nreport.ts 在 zod 校验前注入 result.model，当前功能正常。",
      ["src/lib/llm/prompts/report.md:27-68", "src/lib/agent/steps/report.ts:105-115"],
      "在 report.md 中添加 modelUsed，或明确标注此字段由系统填充");
  } else {
    passed++;
  }
}

console.log("\n" + "═".repeat(60));
console.log("L2: 代码逻辑 Bug 检测");
console.log("═".repeat(60));

// ========== BUG-NEW-005: calcRiskLevel 永远返回 "low" ==========
{
  const monitorSrc = read("src/app/api/monitor/feed/route.ts");
  const patentType = read("src/lib/types/patent.ts");

  // PatentSummary 是否有 ipcClasses
  const summaryMatch = patentType.match(/interface PatentSummary\s*\{([^}]+)\}/);
  const summaryHasIpc = summaryMatch?.[1]?.includes("ipcClasses") ?? false;

  // calcRiskLevel 的 unsafe cast
  const hasCast = monitorSrc.includes("as unknown as { ipcClasses?: string[] }");

  if (!summaryHasIpc && hasCast) {
    failed++; failures.push("❌ BUG-NEW-005: calcRiskLevel 永远返回 'low'");
    addBug("BUG-NEW-005", "🟡 MEDIUM",
      "monitor/feed calcRiskLevel() 永远返回 'low' — PatentSummary 无 ipcClasses",
      `PatentSummary 接口不含 ipcClasses（仅在 PatentDetail 中有）。\n` +
      `calcRiskLevel 通过 unsafe cast 访问 patent.ipcClasses，但搜索 API 返回的 PatentSummary 永远不包含此字段。\n` +
      `matchCount 永远为 0 → 所有专利被标记为 'low' 风险。`,
      ["src/app/api/monitor/feed/route.ts:47", "src/lib/types/patent.ts:15-26"],
      "方案A：搜索 API 附带 ipcClasses\n方案B：基于标题/摘要关键词匹配风险\n方案C：先获取 detail 再算风险");
  } else {
    passed++;
  }
}

// ========== BUG-NEW-006: cleanupExpired 无人调用 ==========
{
  const storeSrc = read("src/lib/session/store.ts");
  const hasCleanup = storeSrc.includes("cleanupExpired");

  // 搜索 src/ 下的调用者
  let hasCaller = false;
  function findCallers(dir: string): void {
    for (const entry of fs.readdirSync(SRC(dir), { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { findCallers(full); }
      else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        if (fs.readFileSync(SRC(full), "utf-8").includes("cleanupExpired")) {
          if (!full.includes("test/")) hasCaller = true;
        }
      }
    }
  }
  findCallers("src");

  if (hasCleanup && !hasCaller) {
    failed++; failures.push("❌ BUG-NEW-006: cleanupExpired() 无人调用 → 内存泄漏");
    addBug("BUG-NEW-006", "🟡 MEDIUM",
      "SessionStore.cleanupExpired() 已定义但从未被调用 → 内存泄漏",
      "cleanupExpired() 方法已实现（2h TTL），但在 src/ 下无任何调用者。\n无 setInterval、无中间件触发、无 cron job。长时间运行内存持续增长。",
      ["src/lib/session/store.ts:138", "（无调用者）"],
      "在 server startup 或 API middleware 添加: setInterval(() => SessionStore.cleanupExpired(), 30*60*1000)");
  } else {
    passed++;
  }
}

// ========== BUG-NEW-007: session/[id] 缺 zod ==========
{
  const route = read("src/app/api/copilot/session/[id]/route.ts");
  const hasZod = route.includes("from \"zod\"") || route.includes("import { z }");

  if (!hasZod) {
    passed++; console.log("  ⚠️ session/[id] route 缺少 zod 校验（不一致但低风险）");
    addBug("BUG-NEW-007", "🟢 LOW",
      "GET /api/copilot/session/[id] 缺少 zod 参数校验",
      "所有其他 API route 用 zod 校验入参，唯此路由直接用 params.id。低风险但不一致。",
      ["src/app/api/copilot/session/[id]/route.ts:14-22"],
      "添加 z.string().min(1) 校验 id 格式");
  } else {
    passed++;
  }
}

// ========== BUG-NEW-008: API routes 返回中文错误消息不一致 ==========
{
  // 检查各 route 的 400 错误是否都用 JSON 格式
  const routes = [
    "src/app/api/copilot/run/route.ts",
    "src/app/api/copilot/search/route.ts",
    "src/app/api/copilot/assess/route.ts",
    "src/app/api/copilot/report/route.ts",
    "src/app/api/search/route.ts",
    "src/app/api/search/detail/route.ts",
  ];

  let allJson = true;
  for (const r of routes) {
    const content = read(r);
    if (!content.includes('"Content-Type", "application/json"') && !content.includes("NextResponse.json")) {
      allJson = false;
      console.log(`  ⚠️ ${r} 错误响应可能不是 JSON`);
    }
  }

  if (allJson) {
    passed++; console.log("  ✅ 所有 API routes 返回 JSON 错误格式");
  }
}

// ========== BUG-NEW-009: report.ts mockJsonReport 无 riskLevel 大小写防护 ==========
{
  const reportSrc = read("src/lib/agent/steps/report.ts");
  const hasToLowerCase = reportSrc.includes("toLowerCase");

  // mockJsonReport 直接比较 riskLevel，无 normalize
  const mockFn = reportSrc.match(/mockJsonReport[\s\S]*?^}/m)?.[0] || "";
  const usesExactCompare = mockFn.includes('riskLevel === "high"') || mockFn.includes("riskLevel === 'high'");

  if (usesExactCompare && !hasToLowerCase) {
    passed++; console.log("  ⚠️ mockJsonReport 无 riskLevel 大小写防护（当前数据一致所以安全，但脆弱）");
    addBug("BUG-NEW-009", "🟢 LOW",
      "mockJsonReport() 无 riskLevel 大小写归一化",
      "mockJsonReport 直接比较 riskLevel === 'high'/'medium'/'low'，无 toLowerCase()。\n当前 mockAssess() 和 LLM prompt 均输出小写，功能正常但上游变更可能导致计数失败。",
      ["src/lib/agent/steps/report.ts:46-47"],
      "在比较前添加 .toLowerCase() 归一化");
  } else {
    passed++;
  }
}

// ===== 汇总 =====
console.log("\n" + "═".repeat(60));
console.log(`静态 Bug 检测结果: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`\n失败:`);
  for (const f of failures) console.log(`  ${f}`);
}
console.log(`\n发现 ${bugs.length} 个 Bug:`);
for (const b of bugs) {
  const emoji = { "🔴 CRITICAL": "🔴", "🟡 HIGH": "🟡", "🟡 MEDIUM": "🟡", "🟢 LOW": "🟢" }[b.severity] || "⚪";
  console.log(`  ${emoji} ${b.id}: ${b.title}`);
  console.log(`     文件: ${b.files.join(", ")}`);
  console.log(`     修复: ${b.fix}`);
  console.log();
}

// 输出 JSON
const report = {
  timestamp: new Date().toISOString(),
  summary: { totalTests: passed + failed, passed, failed },
  bugs,
};
const dir = SRC("test/test-results");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "static-bug-report.json"), JSON.stringify(report, null, 2));
console.log(`📄 JSON 报告: test/test-results/static-bug-report.json`);

process.exit(failed > 0 ? 1 : 0);
