"use client";

/**
 * 🏠 首页 — 研发工作台三栏布局
 *
 * 面向研发工程师张工，展示操作历史 + 我的收藏 + 最新动态 Feed。
 * 数据来自 localStorage（三类历史）和 /api/monitor/feed。
 *
 * v2 修复：
 * - Hydration: bookmarks 初始化不读 localStorage，在 useEffect 中加载
 * - 三栏等大：操作历史 / 我的收藏 / 最新动态
 * - 操作历史链接带 URL 参数，跳转到具体会话
 * - Feed 条目可点击在线预览
 * - "管理关注" → "管理收藏"
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  Search,
  Radio,
  Map,
  Clock,
  ArrowRight,
  RefreshCw,
  Shield,
  Bookmark,
} from "lucide-react";
import type {
  FtoHistoryItem,
  SearchHistoryItem,
  LandscapeHistoryItem,
  MonitorFeedItem,
  PatentSummary,
} from "@/lib/types";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { usePatentPreview } from "@/lib/patent-preview-context";

/** localStorage 安全读 */
function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function HomePage() {
  // ── 历史状态 ──
  const [ftoHistory, setFtoHistory] = useState<FtoHistoryItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [landscapeHistory, setLandscapeHistory] = useState<LandscapeHistoryItem[]>([]);

  // ── Feed 状态 ──
  const [feedTab, setFeedTab] = useState<"tech" | "company">("tech");
  const [feedItems, setFeedItems] = useState<MonitorFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // ── 收藏（hydration-safe: SSR 初始空，客户端 useEffect 加载）──
  const [bookmarks, setBookmarks] = useState<PatentSummary[]>([]);
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const { openPreview } = usePatentPreview();

  // ── 关注技术 ──
  const [watchedTopics] = useState<string[]>(() =>
    safeReadJson("watched-topics", ["BEV感知", "传感器融合", "端到端规划"]),
  );

  // 客户端挂载后加载历史 + 收藏
  useEffect(() => {
    setFtoHistory(safeReadJson("fto-history", []));
    setSearchHistory(safeReadJson("patent-search-history", []));
    setLandscapeHistory(safeReadJson("landscape-history", []));
    const bm = safeReadJson<PatentSummary[]>("bookmarked-patents", []);
    setBookmarks(bm);
    setBookmarksCount(bm.length);
  }, []);

  // 监听收藏变更事件（PatentModal 触发），实时刷新收藏列表
  useEffect(() => {
    const handler = () => {
      const bm = safeReadJson<PatentSummary[]>("bookmarked-patents", []);
      setBookmarks(bm);
      setBookmarksCount(bm.length);
    };
    window.addEventListener("bookmarks-changed", handler);
    return () => window.removeEventListener("bookmarks-changed", handler);
  }, []);

  // 拉取 Feed
  useEffect(() => {
    setFeedLoading(true);
    const url =
      feedTab === "tech"
        ? `/api/monitor/feed?mode=tech&topics=${watchedTopics.join(",")}&days=30&limit=8`
        : `/api/monitor/feed?mode=company&companies=Tesla,Waymo,华为车BU,Mobileye&days=30&limit=8`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setFeedItems((d.items ?? []) as MonitorFeedItem[]))
      .catch(() => setFeedItems([]))
      .finally(() => setFeedLoading(false));
  }, [feedTab, watchedTopics]);

  // 日期格式化
  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days <= 3) return `${days} 天前`;
    if (days <= 7) return "1 周前";
    if (days <= 14) return "2 周前";
    return `${Math.floor(days / 7)} 周前`;
  };

  /** 历史项合并排序（按时间倒序），含原始数据用于构造跳转链接 */
  interface HistoryItem {
    type: "fto" | "search" | "landscape";
    title: string;
    time: string;
    extra: string;
    riskLevel?: "high" | "medium" | "low";
    /** FTO 任务状态 */
    ftoStatus?: "running" | "completed";
    /** 跳转链接（含 URL 参数） */
    link: string;
  }

  const allHistory: HistoryItem[] = [
    ...ftoHistory.map((h) => ({
      type: "fto" as const,
      title: h.title,
      time: h.createdAt,
      extra: h.status === "running" ? "后台运行中..." : `${h.stats.total}件相关 · ${h.stats.high}高${h.stats.medium}中`,
      riskLevel: h.riskLevel,
      ftoStatus: h.status,
      link: `/copilot`,
    })),
    ...searchHistory.map((h) => ({
      type: "search" as const,
      title: h.query,
      time: h.createdAt,
      extra: `${h.resultCount} 条`,
      riskLevel: undefined,
      link: `/search?q=${encodeURIComponent(h.query)}&mode=${h.mode}`,
    })),
    ...landscapeHistory.map((h) => ({
      type: "landscape" as const,
      title: h.query,
      time: h.createdAt,
      extra: `${h.from}-${h.to}`,
      riskLevel: undefined,
      link: `/landscape?q=${encodeURIComponent(h.query)}`,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const ICONS: Record<string, React.ReactNode> = {
    fto: <Shield className="size-3.5 text-blue-500" />,
    search: <Search className="size-3.5 text-green-500" />,
    landscape: <Map className="size-3.5 text-purple-500" />,
  };

  const LABELS: Record<string, string> = {
    fto: "FTO 分析",
    search: "专利检索",
    landscape: "技术布局",
  };

  return (
    <div className="p-6 space-y-6">
      {/* 欢迎横幅 */}
      <div>
        <h1 className="text-2xl font-bold">
          欢迎回来，张工
          <span className="text-base font-normal text-muted-foreground ml-3">
            自动驾驶算法工程师
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          今日待处理：2 项风险预警 · 3 条竞品新专利
        </p>
      </div>

      {/* 快捷演示 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">⚡ 快速演示：</span>
        <Link href="/search?q=时空注意力 传感器融合&mode=keyword" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors">
          <Zap className="size-3"/> 关键词检索
        </Link>
        <Link href="/search?q=US20240123456A1,CN116994312A,EP4189620B1&mode=pn" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors">
          <Zap className="size-3"/> 专利号检索
        </Link>
        <Link href="/landscape?q=BEV感知" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors">
          <Zap className="size-3"/> 技术调研
        </Link>
      </div>

      {/* 常用功能 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            href: "/copilot",
            icon: <Zap className="size-5" />,
            title: "FTO 分析",
            desc: "2 分钟出报告",
            primary: true,
          },
          {
            href: "/search",
            icon: <Search className="size-5" />,
            title: "专利检索",
            desc: "关键词 / 语义",
          },
          {
            href: "/monitor",
            icon: <Radio className="size-5" />,
            title: "竞品监控",
            desc: "技术 / 企业动态",
          },
          {
            href: "/landscape",
            icon: <Map className="size-5" />,
            title: "技术布局",
            desc: "趋势分析调研",
          },
          {
            href: "/bookmarks",
            icon: <Bookmark className="size-5" />,
            title: "我的收藏",
            desc: `${bookmarksCount} 件专利`,
            primary: false,
          },
        ].map((item) => {
          const cardCls = `flex items-center gap-3 rounded-lg border p-4 transition-colors hover:shadow-sm w-full text-left ${
            item.primary
              ? "border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
              : "bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          }`;
          const iconCls = `flex size-10 items-center justify-center rounded-lg shrink-0 ${
            item.primary
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`;
          const inner = (
            <>
              <div className={iconCls}>{item.icon}</div>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </>
          );
          return (
            <Link key={item.href} href={item.href} className={cardCls}>
              {inner}
            </Link>
          );
        })}
      </div>

      {/* 下方三栏等大：操作历史 / 我的收藏 / 最新动态 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左：操作历史 */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            操作历史
          </h2>
          {allHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">暂无操作记录</p>
              <p className="text-xs text-muted-foreground mt-1">
                使用上方快捷功能开始你的 IP 工作
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {allHistory.slice(0, 20).map((item, i) => (
                <Link
                  key={`${item.type}-${i}`}
                  href={item.link}
                  className="flex items-center gap-3 rounded-lg border bg-white dark:bg-zinc-900 p-3 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/10 transition-colors"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
                    {ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {LABELS[item.type]}
                      </span>
                      {item.ftoStatus === "running" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 flex items-center gap-1">
                          <span className="inline-block size-1.5 rounded-full bg-blue-500 animate-pulse" />
                          运行中
                        </span>
                      )}
                      {item.ftoStatus === "completed" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          ✅ 已完成
                        </span>
                      )}
                      {item.type === "fto" && !item.ftoStatus && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          ⏳ 待确认
                        </span>
                      )}
                      {item.riskLevel && item.type !== "fto" && (
                        <RiskBadge level={item.riskLevel} />
                      )}
                    </div>
                    <p className="text-sm truncate">{item.title}</p>
                    {item.extra && (
                      <p className="text-xs text-muted-foreground">{item.extra}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    {timeAgo(item.time)}
                    <ArrowRight className="size-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 中：我的收藏 */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bookmark className="size-4 text-muted-foreground" />
            我的收藏
          </h2>
          {bookmarks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">暂无收藏专利</p>
              <p className="text-xs text-muted-foreground mt-1">
                在专利详情弹窗中点击收藏即可保存
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {bookmarks.map((bm) => (
                <div
                  key={bm.patentId}
                  className="w-full text-left rounded-lg border bg-white dark:bg-zinc-900 p-3 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                >
                  <p className="text-sm font-medium line-clamp-2">{bm.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-mono text-muted-foreground">{bm.pn}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{bm.originalAssignee}</span>
                  </div>
                  <button
                    onClick={() => openPreview(bm)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 transition-colors"
                  >
                    📄 在线预览
                  </button>
                </div>
              ))}
            </div>
          )}
          {bookmarks.length > 0 && (
            <Link
              href="/bookmarks"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              管理收藏
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        {/* 右：最新动态 Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">最新动态</h2>
            <button
              onClick={() => {
                setFeedLoading(true);
                const url =
                  feedTab === "tech"
                    ? `/api/monitor/feed?mode=tech&topics=${watchedTopics.join(",")}&days=30&limit=8`
                    : `/api/monitor/feed?mode=company&companies=Tesla,Waymo,华为车BU,Mobileye&days=30&limit=8`;
                fetch(url)
                  .then((r) => r.json())
                  .then((d) => setFeedItems((d.items ?? []) as MonitorFeedItem[]))
                  .catch(() => {})
                  .finally(() => setFeedLoading(false));
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw className={`size-3 ${feedLoading ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>

          {/* Tab 切换 */}
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setFeedTab("tech")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                feedTab === "tech"
                  ? "bg-white dark:bg-zinc-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              按技术
            </button>
            <button
              onClick={() => setFeedTab("company")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                feedTab === "company"
                  ? "bg-white dark:bg-zinc-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              按企业
            </button>
          </div>

          {/* Feed 列表 */}
          {feedLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-white dark:bg-zinc-900 p-4 animate-pulse"
                >
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">暂无新动态</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {feedItems.map((item, i) => {
                const previewPatent: PatentSummary = {
                  patentId: item.patentId,
                  pn: item.pn,
                  apno: "",
                  title: item.title,
                  originalAssignee: item.originalAssignee,
                  currentAssignee: item.originalAssignee,
                  inventor: "",
                  apdt: 0,
                  pbdt: item.pbdt,
                  authority: item.authority ?? "",
                };
                return (
                  <div
                    key={item.patentId || i}
                    className="w-full text-left rounded-lg border bg-white dark:bg-zinc-900 p-3 space-y-1.5 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        {item.originalAssignee}
                        {(item.matchedTopics?.length ?? 0) > 0 && (
                          <span className="ml-2 text-blue-600 dark:text-blue-400">
                            · {item.matchedTopics!.join(" · ")}
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm leading-snug line-clamp-2">{item.title}</p>
                    <p className="text-xs font-mono text-muted-foreground">{item.pn}</p>
                    <button
                      onClick={() => openPreview(previewPatent)}
                      className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 transition-colors"
                    >
                      📄 在线预览
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
