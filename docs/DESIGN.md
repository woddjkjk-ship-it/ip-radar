# IP Radar 设计说明

本文档说明 IP Radar 的公开架构、模块边界和运行模式。内部验证记录、真实 API Key、个人环境路径和历史测试产物不应写入本文件。

## 1. 产品目标

IP Radar 面向自动驾驶研发场景，帮助研发人员在技术探索、竞品跟踪、方案撰写和风险初筛阶段快速获得专利情报。系统默认使用 Mock 数据，便于本地演示和二次开发；配置 API Key 后可以切换到 Live 模式接入真实数据源。

核心目标：

- 专利检索：支持关键词、语义、企业、专利号检索。
- 竞品监控：展示关注企业和技术方向的专利动态。
- 技术调研：提供趋势、玩家、热词、法律状态和竞争格局视图。
- FTO Copilot：对技术方案进行风险初筛，并保留可追溯中间过程。
- 报告中心：沉淀结构化分析结果，方便复查。

## 2. 运行模式

| 模式 | 数据来源 | 适用场景 |
| --- | --- | --- |
| Mock | `src/fixtures/**` 和 `src/lib/providers/mock*.ts` | 本地体验、演示、无 API Key 构建 |
| Live | `src/lib/providers/patsnap*.ts` | 接入真实专利数据和在线推理 |

Provider 选择由服务端统一处理，UI 和 Agent 编排层不直接感知数据源。Live 模式缺少必要配置时，应返回明确的降级信息，避免误以为正在使用真实数据。

## 3. 架构

```text
Browser
  |
  | pages, components, localStorage, sessionStorage
  v
Next.js App Router
  |
  | API routes
  v
Domain Layer
  |-- PatentDataProvider: MockProvider / PatsnapProvider
  |-- AnalyticsProvider: AnalyticsMockProvider / PatsnapAnalyticsProvider
  |-- Tool Registry: tool definitions + executor
  |-- Skill Layer: smart patent search, tech research planner, monitor configurator
  |-- FTO Pipeline: understand -> search -> assess -> report
  v
External Services
  |-- PatSnap / 智慧芽开放平台
  |-- DeepSeek
  |-- DashScope Qwen-VL
```

## 4. 可追溯性

FTO Copilot 的每一步都会写入 `SessionStore`，用于步骤详情抽屉中的链路复盘：

- 输入快照
- LLM prompt 和原始 response
- FTO 流水线内的外部 API request / response
- 模型、耗时、token 用量
- 中间产物和最终输出

右下角活动日志基于 `LogStore` 展示主要用户链路中的 API、LLM 和系统事件，例如 FTO Copilot、AI 助手、专利检索、专利预览和 AI 摘要。当前实现不是全站统一 API 中间件，因此不承诺所有 Next.js API route 都会自动写入活动日志。

## 5. 本地状态

前端使用固定 localStorage key 存储用户侧状态：

| Key | 说明 |
| --- | --- |
| `fto-history` | FTO Copilot 历史 |
| `patent-search-history` | 专利检索历史 |
| `landscape-history` | 技术调研历史 |
| `watched-topics` | 关注技术 |
| `monitor-subscriptions` | 监控订阅 |
| `bookmarked-patents` | 收藏专利 |
| `monitor-ai-analysis` | 监控订阅 AI 分析缓存 |

`patent-search-history`、`landscape-history`、`monitor-subscriptions` 为空时使用 fixture 初始化，避免首次打开出现空页面。

## 6. 配置边界

- `.env.local.example` 是唯一应提交的环境变量模板。
- `.env.local` 不应提交。
- Mock 数据只放在 `src/fixtures/**` 和 Mock provider 中。
- Live 数据调用只放在 Patsnap provider 中。
- UI、Agent、Tool、Skill 层不得硬编码真实 API Key 或个人路径。

## 7. 验证要求

开源发布前至少执行：

```bash
npm ci --dry-run
npm run build
npm start
```

然后访问 [http://localhost:3000](http://localhost:3000)，确认首页可以打开。涉及 Live 模式的改动，需要在单独的私有环境中配置真实 Key 后验证，不应把验证报告原文提交到公开仓库。
