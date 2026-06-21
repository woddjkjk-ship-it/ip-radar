"use client";

/**
 * ActivityLog — 活动日志悬浮窗
 *
 * 右下角固定按钮（Terminal 图标），点击展开浮窗。
 * 展示 API / LLM / 系统三类日志，可展开查看完整 JSON。
 * 有新日志时红点角标提示。
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Terminal, X, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { logStore, type LogEntry, type LogType } from "@/lib/log-store";

const TYPE_CONFIG: Record<LogType, { icon: string; color: string }> = {
  api: { icon: "🔷", color: "text-blue-600 dark:text-blue-400" },
  llm: { icon: "🟣", color: "text-purple-600 dark:text-purple-400" },
  system: { icon: "⚪", color: "text-zinc-500 dark:text-zinc-400" },
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
}

export function ActivityLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevLen = useRef(0);

  useEffect(() => {
    const unsub = logStore.subscribe(() => {
      const all = logStore.getAll();
      setEntries(all);
      if (!open && all.length > prevLen.current) {
        setHasNew(true);
      }
      prevLen.current = all.length;
    });
    setEntries(logStore.getAll());
    return unsub;
  }, [open]);

  const handleToggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
    setHasNew(false);
  }, []);

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={handleToggleOpen}
        className="fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg hover:scale-105 transition-transform"
      >
        <Terminal className="size-5" />
        {hasNew && (
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" />
        )}
      </button>

      {/* 浮窗 */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-96 h-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-zinc-50 dark:bg-zinc-800">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <Terminal className="size-3.5" /> 活动日志
              <span className="text-muted-foreground font-normal">({entries.length})</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => logStore.clear()}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded"
              >
                清空
              </button>
              <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded">
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">暂无日志</p>
            )}
            {entries.map((entry) => {
              const cfg = TYPE_CONFIG[entry.type];
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="rounded-lg border bg-white dark:bg-zinc-900 p-2.5 text-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {fmtTime(entry.timestamp)}
                        </span>
                        <span className={`font-medium ${cfg.color}`}>{entry.title}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{entry.action}</p>
                      {entry.params && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono truncate">
                          参数：{entry.params}
                        </p>
                      )}
                      {entry.result && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{entry.result}</p>
                      )}

                      {/* 展开 JSON — 仅在有完整数据时显示按钮 */}
                      {(entry.fullRequest != null || entry.fullResponse != null) && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-blue-600 hover:text-blue-700"
                        >
                          {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          展开完整 {entry.type === "api" ? "Response" : entry.type === "llm" ? "Prompt / Response" : "详情"}
                        </button>
                      )}
                      {isExpanded && (
                        <div className="mt-1.5 space-y-1.5">
                          {entry.fullRequest != null && (
                            <details className="bg-zinc-50 dark:bg-zinc-800 rounded p-1.5">
                              <summary className="text-[10px] cursor-pointer">Request</summary>
                              <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto font-mono">
                                {JSON.stringify(entry.fullRequest, null, 2)}
                              </pre>
                            </details>
                          )}
                          {entry.fullResponse != null && (
                            <details className="bg-zinc-50 dark:bg-zinc-800 rounded p-1.5">
                              <summary className="text-[10px] cursor-pointer">Response</summary>
                              <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto font-mono">
                                {JSON.stringify(entry.fullResponse, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
