import { Bot, Bell, Send, ExternalLink } from "lucide-react";

/**
 * ✈️ 飞书集成页 — Server Component
 *
 * 纯静态展示 IP Radar 接入飞书的两种能力：
 * 1. FTO 机器人（模拟聊天气泡）
 * 2. 专利动态推送（配置表单 disabled）
 *
 * 企业集成展示页：说明专利情报能力如何嵌入协作工具。
 */

export default function FeishuPage() {
  return (
    <div className="p-6 space-y-8 max-w-3xl">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Send className="size-6 text-blue-500" />
          飞书集成
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          将 IP Radar 的 IP 情报能力接入飞书工作区，研发工程师无需切换工具
        </p>
      </div>

      {/* 能力一：FTO 机器人 */}
      <section className="rounded-xl border bg-white dark:bg-zinc-900 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900 shrink-0">
            <Bot className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">FTO 机器人</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              在飞书聊天框中 @IP Radar 即可发起专利风险排查，无需切换到 Web 工作台。
              FTO 机器人自动解析聊天消息中的技术方案描述，1-2 分钟返回风险报告。
            </p>
          </div>
        </div>

        {/* 模拟气泡 */}
        <div className="space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
          {/* 用户消息 */}
          <div className="flex items-start gap-2 justify-end">
            <div className="max-w-xs rounded-2xl rounded-br-md bg-blue-500 text-white px-4 py-2.5 text-sm">
              <p className="text-xs text-blue-100 mb-0.5">张工</p>
              @IP Radar /fto 激光雷达Pillar编码3D检测方案，跨模态时空注意力融合，知识蒸馏压缩至30ms
            </div>
            <div className="flex size-7 items-center justify-center rounded-full bg-blue-200 text-blue-700 text-xs font-bold shrink-0">
              张
            </div>
          </div>

          {/* 机器人回复 — 处理中 */}
          <div className="flex items-start gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-bold shrink-0">
              IP
            </div>
            <div className="max-w-xs rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground mb-0.5">IP Radar 机器人</p>
              <span className="inline-flex items-center gap-1 text-zinc-500">
                <span className="size-2 rounded-full bg-zinc-400 animate-pulse" />
                分析中...
              </span>
            </div>
          </div>

          {/* 机器人回复 — 完成 */}
          <div className="flex items-start gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-bold shrink-0">
              IP
            </div>
            <div className="max-w-sm rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm space-y-1.5">
              <p className="text-xs text-muted-foreground mb-0.5">IP Radar 机器人</p>
              <p>✅ 分析完成！</p>
              <p className="text-xs">
                整体风险：<span className="text-amber-600 font-medium">中等</span>
              </p>
              <p className="text-xs">
                相关专利 8 件 · 高风险 <span className="text-red-600 font-bold">2</span> 件 · 中风险 4 件
              </p>
              <span className="inline-block text-xs text-blue-600 font-medium mt-1">
                查看报告 →
              </span>
            </div>
          </div>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          title="演示版暂不支持真实接入"
        >
          <ExternalLink className="size-4" />
          连接飞书工作区
        </button>
      </section>

      {/* 能力二：动态推送 */}
      <section className="rounded-xl border bg-white dark:bg-zinc-900 p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900 shrink-0">
            <Bell className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">专利动态推送</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              当关注的竞品企业有新专利公开、或关注的技术方向有新的专利申请时，
              飞书机器人自动推送通知，研发工程师第一时间获知行业动态。
            </p>
          </div>
        </div>

        {/* 配置表单（全部 disabled） */}
        <div className="space-y-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div>
            <label className="text-xs font-medium text-muted-foreground">推送目标</label>
            <div className="flex gap-3 mt-1.5">
              {["个人消息", "群聊"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pushTarget"
                    defaultChecked={opt === "个人消息"}
                    disabled
                    className="opacity-50"
                  />
                  <span className="text-muted-foreground">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">推送频率</label>
            <div className="flex gap-3 mt-1.5">
              {["实时", "每日汇总", "每周汇总"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pushFreq"
                    defaultChecked={opt === "每日汇总"}
                    disabled
                    className="opacity-50"
                  />
                  <span className="text-muted-foreground">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">关注主题</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {["BEV感知", "传感器融合", "端到端规划"].map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950 text-xs text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 opacity-70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 模拟推送气泡（2条） */}
        <div className="space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-bold shrink-0">
              IP
            </div>
            <div className="max-w-sm rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm space-y-2">
              <p className="text-xs text-muted-foreground mb-0.5">IP Radar 机器人</p>
              <p className="text-xs font-medium">📡 专利动态提醒</p>
              <p className="text-xs">
                Waymo 公开了一件与 <span className="font-medium">BEV感知</span> 相关的新专利
              </p>
              <p className="text-xs font-mono">US12296821B2 · 风险 <span className="text-red-600 font-bold">高</span></p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-blue-600 font-medium">立即查看</span>
                <span className="text-xs text-blue-600 font-medium">加入FTO分析</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 text-xs font-bold shrink-0">
              IP
            </div>
            <div className="max-w-sm rounded-2xl rounded-bl-md bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm space-y-2">
              <p className="text-xs text-muted-foreground mb-0.5">IP Radar 机器人</p>
              <p className="text-xs font-medium">📡 专利动态提醒</p>
              <p className="text-xs">
                Mobileye 在 <span className="font-medium">传感器融合</span> 方向新增 2 件 PCT 申请
              </p>
              <p className="text-xs font-mono">WO2025123456A1 · 风险 <span className="text-amber-600 font-bold">中</span></p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-blue-600 font-medium">立即查看</span>
                <span className="text-xs text-blue-600 font-medium">加入FTO分析</span>
              </div>
            </div>
          </div>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          title="演示版暂不支持真实接入"
        >
          <ExternalLink className="size-4" />
          连接飞书工作区
        </button>
      </section>
    </div>
  );
}
