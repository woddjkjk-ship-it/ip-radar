<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# IP Radar 项目协作约定

## 强制原则
1. **普适性 > 剧本**:Demo 必须对任意合理输入都能跑通,严禁 `if (input.includes("X"))` 之类硬编码。
2. **Mock vs Live 严格隔离**:Mock 数据只在 `src/fixtures/**` + `src/lib/providers/mock.ts`;Live 实现只在 `src/lib/providers/patsnap.ts`;UI 和 Agent 编排层不得感知数据源。
3. **全流程可追溯**:Copilot 4 步任何一步,LLM 调用/外部 API 调用都必须 append 到 `SessionStore`,前端 `StepDetailDrawer` 可展开看原始 prompt/response。

## 编码约定
- TypeScript strict 模式,**禁止 `any`**,实在不知道用 `unknown` + 类型守卫。
- 所有 API route 入参用 `zod` 校验;所有 LLM 输出用 `zod.safeParse` 校验,失败重试 1 次。
- 函数式优先,组件用 React Server Components 除非必须 `'use client'`。
- 单文件 ≤ 300 行,超过即拆。
- 中文注释,JSDoc 风格说明意图(WHY),不解释 WHAT(代码即文档)。

## 不得改动
- `src/components/ui/**`(shadcn 生成,需调整时用 `npx shadcn` 重新生成)
- `next.config.ts` / `tsconfig.json` / `postcss.config.mjs`(除非任务明确需要)
- `.env.local`(不存在于 git,只用 `.env.local.example` 作模板)
- `docs/DESIGN.md`(基准设计文档,Section 1-6 已确认,重大架构变更需经用户确认)

## LocalStorage 键约定(M5 标品模块)

标品模块使用 localStorage 存储用户状态，键名固定，不得自行新增：

| 键 | 类型 | 用途 |
|----|------|------|
| `fto-history` | `FtoHistoryItem[]` | FTO Copilot 历史记录 |
| `patent-search-history` | `SearchHistoryItem[]` | 专利检索历史 |
| `landscape-history` | `LandscapeHistoryItem[]` | 技术调研 Copilot 任务历史 |
| `watched-topics` | `string[]` | 关注技术列表，默认 `["BEV感知","传感器融合","端到端规划"]` |
| `monitor-subscriptions` | `MonitorSubscription[]` | 竞品监控订阅列表 |
| `bookmarked-patents` | `PatentSummary[]` | 收藏的专利列表 |
| `monitor-ai-analysis` | `Record<string, string>` | 监控订阅 AI 分析缓存（key=订阅id） |

**空值初始化策略**：以下键在 localStorage 为空时，必须用对应 fixture 文件的默认数据初始化，不得显示空态：

| 键 | 默认数据来源 | 初始条数 |
|----|------------|---------|
| `patent-search-history` | `src/fixtures/search-history-default.ts` | 5条 |
| `landscape-history` | `src/fixtures/landscape-history-default.ts` | 3条 |
| `monitor-subscriptions` | `src/fixtures/monitor-subscriptions-default.ts` | 2条 |

（`fto-history` 和 `watched-topics` 允许空态，前者有引导文字，后者有默认3个topic）

## 验证
- 每次改完跑 `npm run build` 必须 0 编译错误。
- 改 Copilot 链路必须能在 Mock 模式下端到端走通(`npm run dev` → 浏览器手动验证)。
- 改 M5 标品模块必须验证：
  - Header 无全局搜索框
  - 专利检索：左侧有5条默认历史 → 四个Tab各有演示按钮 → 专利号Tab演示提交后有3条结果
  - 竞品监控：竞品概览卡片有技术标签+代表专利 → 监控订阅默认2条（有未读角标）
  - 技术调研 Copilot：左侧有3条默认历史 → 演示按钮自动填入并触发 → 全5个Tab有数据 → TOP5专利可点击预览
  - 首页历史/Feed 有数据 → 监控 Tab 可切换
- 改 FTO Copilot 界面必须验证：左侧历史栏 → 输入方案 → 横向步骤条 → TechSummaryCard 确认 → 完成后出现 ResultVerdictCard + NextActionsCard → fto-history localStorage 有记录。
- 改 PatentModal 必须验证：Live 模式 P020 PDF 可 iframe 显示 + Mock 模式演示专利本地 PDF 加载正常 + 收藏按钮写入 bookmarked-patents。
- 改 AI 助手必须验证：自然语言输入 → Skill.execute() → DeepSeek function calling → 正确选择 Tool → 参数填入对应手动字段 → 触发执行。
- 改 MCP Tool 层必须验证：`src/lib/tools/definitions/` 下每个 Tool 有完整的 name + description + inputSchema + execute。
- 改 Skill 层必须验证：`src/lib/tools/skills/` 下每个 Skill 有完整的 name + displayName + systemPrompt + tools + execute，Skill 执行全流程写入 LogStore。
- 改活动日志必须验证：API / LLM / 系统三类日志写入 LogStore + 悬浮窗展开可查看完整 JSON + AI 助手 Skill 执行日志链完整（启动→路由→Tool→完成）。

## LocalStorage 类型定义（完整）

```typescript
// ── FTO Copilot 历史 ──
interface FtoHistoryItem {
  id: string           // sessionId
  title: string        // FtoReport.title
  keywords: string[]   // 最多 5 个关键词
  riskLevel: 'high' | 'medium' | 'low'
  stats: { total: number; high: number; medium: number }
  createdAt: string    // ISO 8601
  reportJson: string   // JSON.stringify(FtoReport)
}

// ── 专利检索历史 ──
interface SearchHistoryItem {
  id: string
  query: string        // 用户输入的检索词（专利号模式下为逗号拼接，截断50字）
  mode: 'keyword' | 'semantic' | 'company' | 'pn'  // pn = 专利号检索
  resultCount: number
  createdAt: string    // ISO 8601
}

// ── 技术布局任务历史 ──
interface LandscapeHistoryItem {
  id: string
  query: string        // 技术主题词
  from: number         // 起始年份，如 2018
  to: number           // 截止年份，如 2025
  authorities: string[] // 受理局，如 ['CN','US','EP']
  tabsLoaded: ('trend' | 'players' | 'hotwords' | 'status' | 'competition')[]
  createdAt: string    // ISO 8601
}

// ── 竞品监控订阅（M6 扩展版）──
interface MonitorSubscription {
  id: string
  name: string
  query: string
  companies?: string[]                        // 关注企业列表（可选）
  frequency: 'realtime' | 'daily' | 'weekly' // 推送频率
  pushChannel: ('site' | 'feishu')[]          // 推送渠道（飞书暂为 disabled）
  ipcFilter?: string[]                        // IPC 前缀过滤（选填）
  authorityFilter?: string[]                  // 受理局过滤（选填）
  createdAt: string
  lastTriggered?: string                      // 上次推送时间 ISO 8601
  newCount?: number                           // 未读新专利数（角标用）
  status: 'active' | 'paused'
}
```
