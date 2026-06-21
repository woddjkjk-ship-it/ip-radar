"use client";

/**
 * Header — 顶部栏
 *
 * 固定显示张工身份，含 Mock⇄Live 模式切换。
 * 模式通过 localStorage 持久化，避免页面刷新后回跳。
 * 同步设置 Cookie 供服务端 getProvider() 读取。
 */

import { useState, useEffect, useCallback } from "react";
import { User } from "lucide-react";

export function Header() {
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // 挂载后从 localStorage 恢复上次选择的模式
  useEffect(() => {
    const stored = localStorage.getItem("data-mode") as "mock" | "live" | null;
    if (stored === "mock" || stored === "live") {
      setMode(stored);
    }
    // 恢复 sessionStorage 中的临时 API Key
    const storedKey = sessionStorage.getItem("patsnap-api-key");
    if (storedKey) setApiKey(storedKey);
  }, []);

  const applyMode = useCallback((next: "mock" | "live") => {
    localStorage.setItem("data-mode", next);
    document.cookie = `data-mode=${next}; path=/; max-age=86400; SameSite=Lax`;
    setMode(next);
  }, []);

  const handleToggle = () => {
    if (mode === "mock") {
      // Mock → Live：弹窗确认 API Key
      setShowLiveModal(true);
    } else {
      // Live → Mock：直接切换
      applyMode("mock");
    }
  };

  const handleConfirmLive = () => {
    if (apiKey.trim()) {
      sessionStorage.setItem("patsnap-api-key", apiKey.trim());
    } else {
      sessionStorage.removeItem("patsnap-api-key");
    }
    applyMode("live");
    setShowLiveModal(false);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b bg-white/95 backdrop-blur dark:bg-zinc-950/95 dark:border-zinc-800">
      {/* 左侧留空 */}
      <div />

      {/* 右侧操作区 */}
      <div className="flex items-center gap-3">
        {/* 模式切换 */}
        <button
          onClick={handleToggle}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            mode === "live"
              ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700"
              : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              mode === "live" ? "bg-green-500" : "bg-zinc-400"
            }`}
          />
          API: {mode === "live" ? "Live" : "Mock"}
        </button>

        {/* 固定身份：张工 | 自动驾驶算法工程师 */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="size-4" />
          <span className="hidden sm:inline">张工</span>
          <span className="hidden md:inline text-xs text-muted-foreground/60 border-l pl-2">
            自动驾驶算法工程师
          </span>
        </div>
      </div>

      {/* Live 切换确认弹窗 */}
      {showLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLiveModal(false)} />
          <div className="relative w-96 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold">切换到 Live 模式</h3>
            <p className="text-xs text-muted-foreground">
              将使用智慧芽 DATA API 真实数据。请在下方输入 API Key，或留空使用环境变量中的默认值。
            </p>
            <div>
              <label className="text-xs font-medium">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="留空则使用 .env.local 中的 PATSNAP_API_KEY"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Key 仅存储在当次浏览器会话中（sessionStorage），不会写入文件。
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLiveModal(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
              <button
                onClick={handleConfirmLive}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
