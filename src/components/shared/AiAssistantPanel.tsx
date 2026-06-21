"use client";

/**
 * AiAssistantPanel — 可复用的 AI 助手输入面板
 *
 * 嵌入到检索/调研/监控页面，提供自然语言输入 → DeepSeek 解析 → 执行 Skill。
 * 右侧 🎤 按钮（静态，点击显示 tooltip「语音输入即将支持」）。
 *
 * Props:
 * - skillName: 'smart_patent_search' | 'tech_research_planner' | 'monitor_configurator'
 * - onAction: (action: SkillAction) => void — 前端收到 UI 动作后的回调
 * - placeholder: 输入框占位文字
 * - loading: 是否正在执行
 * - onLoadingChange: 设置 loading 状态
 */

import { useState, useCallback } from "react";
import { Sparkles, Mic, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { logStore } from "@/lib/log-store";
import type { SkillAction } from "@/lib/tools/types";
import { SKILL_DEMO_CASES } from "@/fixtures/skill-demo-fixtures";

interface AiAssistantPanelProps {
  skillName: "smart_patent_search" | "tech_research_planner" | "monitor_configurator";
  onAction: (action: SkillAction) => void;
  placeholder: string;
}

export function AiAssistantPanel({ skillName, onAction, placeholder }: AiAssistantPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micTooltip, setMicTooltip] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    setLoading(true);

    try {
      // 调服务端 API 代理执行 Skill（保护 DeepSeek Key 不暴露到客户端）
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, userInput: input }),
      });

      const result = await res.json();

      if (!res.ok) {
        logStore.append({ type: "system", title: "AI 助手 错误", action: result.error ?? `HTTP ${res.status}` });
        return;
      }

      const action = result.action;
      const actionSummary = action
        ? `${action.tab ?? action.type ?? "?"} → ${JSON.stringify(action.params ?? {}).slice(0, 80)}`
        : "无动作";

      logStore.append({
        type: result.success ? "api" : "system",
        title: `AI 助手 · DeepSeek — ${skillName === "smart_patent_search" ? "智能检索" : skillName === "tech_research_planner" ? "技术调研" : "竞品监控"}`,
        action: `输入: "${input.slice(0, 60)}"`,
        result: result.success ? `✅ ${actionSummary}` : `⚠️ 降级: ${actionSummary}`,
        fullResponse: { success: result.success, action, rawResponse: result.rawResponse?.slice?.(0, 300) },
      });

      if (action) {
        onAction(action);
      }

      if (!result.success && result.fallbackInput) {
        // 降级：填入原始输入
        onAction({
          type: "fill_and_search",
          params: { query: result.fallbackInput },
          autoSubmit: false,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStore.append({ type: "system", title: "AI 助手 异常", action: msg });
    } finally {
      setLoading(false);
    }
  }, [input, loading, skillName, onAction]);

  return (
    <div className="space-y-2">
      {/* 展开/折叠按钮 */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Sparkles className="size-3.5" />
        AI 助手
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                执行
              </button>
              <div className="relative">
                <button
                  onClick={() => setMicTooltip((p) => !p)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
                >
                  <Mic className="size-4" />
                </button>
                {micTooltip && (
                  <div className="absolute right-0 top-full mt-1 bg-zinc-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-50">
                    语音输入即将支持
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* 演示案例 */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground self-center">试试：</span>
            {(SKILL_DEMO_CASES[skillName] ?? []).map((demo, i) => (
              <button
                key={i}
                onClick={() => setInput(demo.demoText)}
                className="px-2 py-0.5 text-[10px] rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors truncate max-w-[180px]"
                title={demo.demoText}
              >
                {demo.chipLabel}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
