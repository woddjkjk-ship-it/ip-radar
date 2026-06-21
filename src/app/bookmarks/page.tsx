"use client";

/**
 * 🔖 我的收藏 — 独立收藏专利页面
 *
 * 读 localStorage bookmarked-patents，展示所有收藏专利。
 * 支持在线预览、取消收藏、搜索过滤。
 */

import { useState, useEffect } from "react";
import { Bookmark, Trash2, Search, ExternalLink } from "lucide-react";
import { usePatentPreview } from "@/lib/patent-preview-context";
import { logStore } from "@/lib/log-store";
import type { PatentSummary } from "@/lib/types";

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<PatentSummary[]>([]);
  const [search, setSearch] = useState("");
  const { openPreview } = usePatentPreview();

  useEffect(() => {
    setBookmarks(safeReadJson("bookmarked-patents", []));
  }, []);

  // 实时同步：监听 PatentModal 触发的收藏变更事件
  useEffect(() => {
    const handler = () => setBookmarks(safeReadJson("bookmarked-patents", []));
    window.addEventListener("bookmarks-changed", handler);
    return () => window.removeEventListener("bookmarks-changed", handler);
  }, []);

  const removeBookmark = (patentId: string) => {
    const removed = bookmarks.find((b) => b.patentId === patentId);
    const updated = bookmarks.filter((b) => b.patentId !== patentId);
    setBookmarks(updated);
    try {
      localStorage.setItem("bookmarked-patents", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("bookmarks-changed"));
    } catch { /* ignore */ }
    if (removed) {
      logStore.append({ type: "system", title: "取消收藏", action: `${removed.pn} — ${removed.title?.slice(0, 40)}` });
    }
  };

  const handlePreview = (bm: PatentSummary) => {
    logStore.append({ type: "system", title: "专利预览", action: `${bm.pn} — ${bm.title?.slice(0, 40)}` });
    openPreview(bm);
  };

  const filtered = search.trim()
    ? bookmarks.filter(
        (b) =>
          b.title.toLowerCase().includes(search.toLowerCase()) ||
          b.pn.toLowerCase().includes(search.toLowerCase()) ||
          b.originalAssignee.toLowerCase().includes(search.toLowerCase()),
      )
    : bookmarks;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="size-6 text-blue-600" />
          我的收藏
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          已收藏 {bookmarks.length} 件专利
        </p>
      </div>

      {/* 搜索过滤 */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索收藏专利..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {bookmarks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
          <Bookmark className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">暂无收藏专利</p>
          <p className="text-xs text-muted-foreground">
            在任意专利详情弹窗中点击「收藏」按钮即可保存
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">未找到匹配的收藏</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bm) => (
            <div
              key={bm.patentId}
              className="flex items-center gap-4 rounded-lg border bg-white dark:bg-zinc-900 p-4 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{bm.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-mono">{bm.pn}</span>
                  <span>{bm.originalAssignee}</span>
                  <span>{bm.authority}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handlePreview(bm)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
                >
                  <ExternalLink className="size-3" />
                  预览
                </button>
                <button
                  onClick={() => removeBookmark(bm.patentId)}
                  className="p-1.5 text-muted-foreground hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950"
                  title="取消收藏"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
