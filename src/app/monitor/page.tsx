"use client";

/**
 * 📡 竞品监控页（v2 — 丰富竞品卡片 + 默认订阅）
 *
 * 3 Tab：动态速览 / 竞品概览 / 监控订阅。
 * 概览卡片调 /api/monitor/competitor-stats 获取丰富数据。
 * 订阅 Tab：空值时用 fixture 初始化 2 条。
 */

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  TrendingUp,
  Loader2,
  Bell,
  Sparkles,
  Plus,
  Trash2,
  BadgeCheck,
} from "lucide-react";
import { usePatentPreview } from "@/lib/patent-preview-context";
import { AiAssistantPanel } from "@/components/shared/AiAssistantPanel";
import { DEFAULT_SUBSCRIPTIONS } from "@/fixtures/monitor-subscriptions-default";
import type { CompetitorStat, RepPatent } from "@/fixtures/competitor-stats";
import type {
  PatentSummary,
  MonitorFeedItem,
  MonitorSubscription,
} from "@/lib/types";

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

function saveToLocalStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function readSubscriptions(): MonitorSubscription[] {
  try {
    const raw = localStorage.getItem("monitor-subscriptions");
    if (!raw) {
      localStorage.setItem("monitor-subscriptions", JSON.stringify(DEFAULT_SUBSCRIPTIONS));
      return DEFAULT_SUBSCRIPTIONS as MonitorSubscription[];
    }
    return JSON.parse(raw) as MonitorSubscription[];
  } catch {
    return DEFAULT_SUBSCRIPTIONS as MonitorSubscription[];
  }
}

/** YYYYMMDD → YYYY-MM-DD */
function formatDate(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const COMPETITORS = ["Tesla", "Waymo", "华为车BU", "Mobileye", "Nvidia", "小鹏", "地平线"];

export default function MonitorPage() {
  const [tab, setTab] = useState<"feed" | "overview" | "subscriptions">("feed");

  // Feed
  const [feedMode, setFeedMode] = useState<"tech" | "company">("tech");
  const [days, setDays] = useState(30);
  const [feedItems, setFeedItems] = useState<MonitorFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  // 初始值用默认列表，避免 SSR hydration 与 localStorage 不一致
  const [watchedTopics, setWatchedTopics] = useState<string[]>(["BEV感知", "传感器融合", "端到端规划"]);
  // 客户端挂载后从 localStorage 恢复用户自定义列表
  useEffect(() => {
    const stored = safeReadJson("watched-topics", ["BEV感知", "传感器融合", "端到端规划"]);
    setWatchedTopics(stored);
  }, []);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  // 概览
  const [compStats, setCompStats] = useState<Record<string, CompetitorStat>>({});
  const [overviewLoading, setOverviewLoading] = useState(false);

  // 订阅
  const [subscriptions, setSubscriptions] = useState<MonitorSubscription[]>([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subName, setSubName] = useState("");
  const [subQuery, setSubQuery] = useState("");
  const [subCompanies, setSubCompanies] = useState("");
  const [subFreq, setSubFreq] = useState<"daily" | "weekly" | "realtime">("daily");
  const [subAuthorities, setSubAuthorities] = useState<string[]>([]);

  // 抽屉
  const { openPreview } = usePatentPreview();

  // ── 监控 AI 分析缓存 ──
  const [aiCache, setAiCache] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("monitor-ai-analysis") ?? "{}"); } catch { return {}; }
  });
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  /** AI 分析面板折叠状态 */
  const [aiExpanded, setAiExpanded] = useState<Record<string, boolean>>({});

  const requestAiAnalysis = useCallback(async (sub: MonitorSubscription) => {
    // 已有缓存 → 切换展示/隐藏
    if (aiCache[sub.id]) {
      setAiExpanded((p) => ({ ...p, [sub.id]: !p[sub.id] }));
      return;
    }
    if (aiLoading[sub.id]) return;
    setAiLoading((p) => ({ ...p, [sub.id]: true }));
    try {
      const res = await fetch("/api/monitor/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: sub.id,
          name: sub.name,
          query: sub.query,
          companies: sub.companies,
          newPatentTitles: [
            "US12296821B2 · 基于多模态融合的感知增强方法",
            "CN118765432A · 端到端自动驾驶决策优化",
            "EP4567890B1 · Sensor calibration framework for autonomous driving",
          ],
        }),
      });
      const data = await res.json();
      const analysis = (data.analysis as string) ?? "分析不可用";
      const updated = { ...aiCache, [sub.id]: analysis };
      setAiCache(updated);
      localStorage.setItem("monitor-ai-analysis", JSON.stringify(updated));
      setAiExpanded((p) => ({ ...p, [sub.id]: true }));
    } catch { /* ignore */ }
    finally { setAiLoading((p) => ({ ...p, [sub.id]: false })); }
  }, [aiCache, aiLoading]);

  /** 重新分析：清除缓存并重新请求 */
  const reanalyze = useCallback((sub: MonitorSubscription) => {
    const updated = { ...aiCache };
    delete updated[sub.id];
    setAiCache(updated);
    localStorage.setItem("monitor-ai-analysis", JSON.stringify(updated));
    setAiExpanded((p) => ({ ...p, [sub.id]: false }));
    // 延迟触发新请求
    setTimeout(() => {
      if (aiLoading[sub.id]) return;
      setAiLoading((p) => ({ ...p, [sub.id]: true }));
      fetch("/api/monitor/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: sub.id,
          name: sub.name,
          query: sub.query,
          companies: sub.companies,
          newPatentTitles: [
            "US12296821B2 · 基于多模态融合的感知增强方法",
            "CN118765432A · 端到端自动驾驶决策优化",
            "EP4567890B1 · Sensor calibration framework for autonomous driving",
          ],
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const analysis = (data.analysis as string) ?? "分析不可用";
          const updated2 = { ...aiCache, [sub.id]: analysis };
          setAiCache(updated2);
          localStorage.setItem("monitor-ai-analysis", JSON.stringify(updated2));
          setAiExpanded((p) => ({ ...p, [sub.id]: true }));
        })
        .catch(() => {})
        .finally(() => setAiLoading((p) => ({ ...p, [sub.id]: false })));
    }, 50);
  }, [aiCache, aiLoading]);

  useEffect(() => { setSubscriptions(readSubscriptions()); }, []);

  // Feed
  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const url =
        feedMode === "tech"
          ? `/api/monitor/feed?mode=tech&topics=${watchedTopics.join(",")}&days=${days}&limit=20`
          : `/api/monitor/feed?mode=company&companies=${COMPETITORS.join(",")}&days=${days}&limit=20`;
      const res = await fetch(url);
      const d = await res.json();
      setFeedItems((d.items ?? []) as MonitorFeedItem[]);
    } catch { setFeedItems([]); } finally { setFeedLoading(false); }
  }, [feedMode, watchedTopics, days]);

  useEffect(() => { if (tab === "feed") fetchFeed(); }, [tab, fetchFeed]);

  // 概览
  useEffect(() => {
    if (tab !== "overview") return;
    setOverviewLoading(true);
    fetch("/api/monitor/competitor-stats")
      .then((r) => r.json())
      .then((d) => setCompStats((d.stats ?? {}) as Record<string, CompetitorStat>))
      .catch(() => setCompStats({}))
      .finally(() => setOverviewLoading(false));
  }, [tab]);

  const addTopic = () => {
    const t = newTopic.trim();
    if (!t || watchedTopics.includes(t)) return;
    const updated = [...watchedTopics, t];
    setWatchedTopics(updated);
    saveToLocalStorage("watched-topics", updated);
    setNewTopic("");
  };
  const removeTopic = (t: string) => {
    const updated = watchedTopics.filter((x) => x !== t);
    setWatchedTopics(updated);
    saveToLocalStorage("watched-topics", updated);
  };

  const createSubscription = async () => {
    if (!subName.trim() || !subQuery.trim()) return;
    const item: MonitorSubscription = {
      id: `sub_${Date.now()}`,
      name: subName.trim(),
      query: subQuery.trim(),
      companies: subCompanies.trim() ? subCompanies.split(/[,，、]/).map(s => s.trim()).filter(Boolean) : undefined,
      frequency: subFreq,
      pushChannel: ["site"],
      authorityFilter: subAuthorities.length > 0 ? subAuthorities : undefined,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    const updated = [item, ...subscriptions];
    saveToLocalStorage("monitor-subscriptions", updated);
    setSubscriptions(updated);
    setSubName(""); setSubQuery(""); setSubCompanies("");
    setSubFreq("daily"); setSubAuthorities([]);
    setShowSubModal(false);
  };
  const deleteSubscription = (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id);
    saveToLocalStorage("monitor-subscriptions", updated);
    setSubscriptions(updated);
  };

  const openDetail = (item: MonitorFeedItem) => {
    openPreview({
      patentId: item.patentId, pn: item.pn, apno: "",
      title: item.title, originalAssignee: item.originalAssignee,
      currentAssignee: item.originalAssignee, inventor: "",
      apdt: 0, pbdt: item.pbdt, authority: item.authority,
    });
  };

  const freqLabel: Record<string, string> = { realtime: "实时", daily: "每日", weekly: "每周" };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">📡 竞品监控</h1>

      {/* AI 助手 */}
      <AiAssistantPanel
        skillName="monitor_configurator"
        placeholder="例如：帮我监控 Waymo 和特斯拉最近的多模态感知专利"
        onAction={(action) => {
          if (action.params.name) setSubName(String(action.params.name));
          if (action.params.query) setSubQuery(String(action.params.query));
          setTab("subscriptions" as typeof tab);
          setShowSubModal(true);
        }}
      />

      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 w-fit">
        {[
          { key: "feed", label: "动态速览" },
          { key: "overview", label: "竞品概览" },
          { key: "subscriptions", label: "监控订阅" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t.key ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      {tab === "feed" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              <button onClick={() => setFeedMode("tech")} className={`px-3 py-1 text-xs font-medium rounded-md ${feedMode === "tech" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-muted-foreground"}`}>按技术</button>
              <button onClick={() => setFeedMode("company")} className={`px-3 py-1 text-xs font-medium rounded-md ${feedMode === "company" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-muted-foreground"}`}>按企业</button>
            </div>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-1 text-xs rounded-full border ${days === d ? "bg-blue-100 text-blue-700 border-blue-300" : "text-muted-foreground border-zinc-200 hover:border-zinc-300"}`}>{d} 天</button>
              ))}
            </div>
          </div>
          {feedMode === "tech" && (
            <div className="flex flex-wrap items-center gap-1.5">
              {watchedTopics.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-xs font-medium text-blue-700 dark:text-blue-300">
                  {t}<button onClick={() => removeTopic(t)} className="hover:text-red-500">×</button>
                </span>
              ))}
              <button onClick={() => setShowTopicModal(true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> 添加</button>
            </div>
          )}
          {feedLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1,2,3,4].map((i)=><div key={i} className="rounded-lg border p-4 animate-pulse space-y-2"><div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"/><div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4"/></div>)}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center"><Bell className="size-6 text-muted-foreground mx-auto mb-2"/><p className="text-sm text-muted-foreground">暂无新动态</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {feedItems.map((item,i)=>(<div key={item.patentId||i} className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-2 hover:shadow-sm">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Building2 className="size-3"/>{item.originalAssignee}</span></div>
                <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="font-mono">{item.pn}</span><span>{formatDate(item.pbdt)}</span>{(item.matchedTopics?.length ?? 0) > 0 && <span className="text-blue-600">命中：{item.matchedTopics!.join(" · ")}</span>}</div>
                <div className="flex justify-end">
                  <button type="button" onClick={(e) => { e.stopPropagation(); openDetail(item); }} className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">📄 预览</button>
                </div>
              </div>))}
            </div>
          )}
          {showTopicModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                <h3 className="text-sm font-semibold">添加关注技术</h3>
                <input value={newTopic} onChange={(e)=>setNewTopic(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addTopic()} placeholder="输入技术关键词..." className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" autoFocus/>
                <div className="flex gap-2 justify-end"><button onClick={()=>setShowTopicModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button><button onClick={addTopic} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">添加</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 竞品概览（丰富卡片）── */}
      {tab === "overview" && (
        <div>
          {overviewLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground"/></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMPETITORS.map((name) => {
                const s = compStats[name];
                if (!s) return null;
                return (
                  <div key={name} className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900"><Building2 className="size-5 text-blue-600 dark:text-blue-400"/></div>
                        <div><h3 className="font-semibold">{name}</h3><p className="text-xs text-muted-foreground">总专利 {s.total.toLocaleString()} 件</p></div>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><TrendingUp className="size-3"/>+{s.newThisMonth}</span>
                    </div>
                    {/* 近6月新增趋势 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">近6月新增趋势</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">月均 {Math.round(s.trend6m.reduce((a,b)=>a+b,0)/6)} 件</span>
                      </div>
                      {(() => {
                        const max = Math.max(...s.trend6m, 1);
                        return (
                          <div className="flex gap-1.5 items-end" style={{height:32}}>
                            {s.trend6m.map((h,i)=>(
                              <div
                                key={i}
                                className="flex-1 rounded-sm bg-blue-500/30 dark:bg-blue-400/20 hover:bg-blue-500/50 dark:hover:bg-blue-400/40 transition-colors cursor-default"
                                style={{height:`${(h/max)*28}px`, minHeight:4}}
                                title={`第${i+1}月: ${h} 件`}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    {/* 核心技术标签 */}
                    <div className="flex flex-wrap gap-1">
                      {s.coreTech.map((t)=>(<span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-[10px] font-medium text-blue-700 dark:text-blue-300">{t}</span>))}
                    </div>
                    {/* 代表专利（2条，点击预览按钮查看） */}
                    <div className="space-y-1">
                      {s.repPatents.map((rp: RepPatent, ri: number) => (
                        <div key={ri} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground line-clamp-1 flex-1">{rp.title}</span>
                          <button
                            onClick={() => openPreview({
                              patentId: `comp-${name}-${ri}`,
                              pn: rp.pn, apno: "",
                              title: rp.title,
                              originalAssignee: name,
                              currentAssignee: name, inventor: "",
                              apdt: 0, pbdt: 0, authority: rp.pn.startsWith("CN") ? "CN" : "US",
                            })}
                            className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
                          >
                            📄 预览
                          </button>
                        </div>
                      ))}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 监控订阅 ── */}
      {tab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">已创建 {subscriptions.length} 个监控</p>
            <button onClick={()=>setShowSubModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"><Plus className="size-3.5"/>新建监控</button>
          </div>
          {subscriptions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center"><Bell className="size-6 text-muted-foreground mx-auto mb-2"/><p className="text-sm text-muted-foreground">暂无监控订阅</p></div>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="rounded-lg border bg-white dark:bg-zinc-900 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="size-4 text-blue-500 shrink-0"/>
                      <span className="text-sm font-medium">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.newCount != null && sub.newCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{sub.newCount}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sub.status === "active" ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {sub.status === "active" ? "运行中" : "已暂停"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{sub.query}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {sub.companies && sub.companies.length > 0 && (
                      <span>{sub.companies.join(" · ")}</span>
                    )}
                    <span>{freqLabel[sub.frequency] ?? sub.frequency}推送</span>
                    {sub.lastTriggered && (
                      <span>上次推送：{new Date(sub.lastTriggered).toLocaleDateString("zh-CN")}</span>
                    )}
                    <span>创建于 {new Date(sub.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => requestAiAnalysis(sub)}
                      disabled={aiLoading[sub.id]}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Sparkles className="size-3" />
                      {aiLoading[sub.id] ? "分析中..." : aiCache[sub.id] ? (aiExpanded[sub.id] ? "收起AI分析" : "查看AI分析") : "AI分析"}
                    </button>
                    {aiCache[sub.id] && (
                      <button onClick={() => reanalyze(sub)} disabled={aiLoading[sub.id]} className="text-xs text-muted-foreground hover:text-blue-600 flex items-center gap-1 disabled:opacity-50">
                        <Sparkles className="size-3" />重新分析
                      </button>
                    )}
                    <button onClick={()=>deleteSubscription(sub.id)} className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"><Trash2 className="size-3"/>删除</button>
                  </div>
                  {aiCache[sub.id] && aiExpanded[sub.id] !== false && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">🤖 AI 分析</p>
                      {aiCache[sub.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {showSubModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-sm font-semibold">新建专利监控</h3>

                {/* 监控名称 */}
                <div>
                  <label className="text-xs font-medium">监控名称 <span className="text-red-400">*</span></label>
                  <input value={subName} onChange={(e)=>setSubName(e.target.value)} placeholder="如：BEV感知 — Waymo" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
                  <p className="text-[10px] text-muted-foreground mt-0.5">为这个监控规则命名，方便后续管理</p>
                </div>

                {/* 监控检索条件 */}
                <div>
                  <label className="text-xs font-medium">监控检索条件 <span className="text-red-400">*</span></label>
                  <input value={subQuery} onChange={(e)=>setSubQuery(e.target.value)} placeholder='例: TACD:("BEV perception") 或 传感器融合 AND 自动驾驶' className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
                  <p className="text-[10px] text-muted-foreground mt-0.5">支持关键词、布尔逻辑组合，系统按此条件持续抓取新专利</p>
                </div>

                {/* 关注企业（选填） */}
                <div>
                  <label className="text-xs font-medium">关注企业（选填）</label>
                  <input value={subCompanies} onChange={(e)=>setSubCompanies(e.target.value)} placeholder="逗号分隔，如：Tesla, Waymo, 华为" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
                </div>

                {/* 受理局（选填） */}
                <div>
                  <label className="text-xs font-medium">受理局范围（选填，不选则全部）</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {["CN", "US", "EP", "JP", "WO"].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setSubAuthorities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          subAuthorities.includes(a)
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 推送频率 */}
                <div>
                  <label className="text-xs font-medium">推送频率</label>
                  <select
                    value={subFreq}
                    onChange={(e) => setSubFreq(e.target.value as typeof subFreq)}
                    className="w-full mt-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  >
                    <option value="realtime">实时推送</option>
                    <option value="daily">每日汇总</option>
                    <option value="weekly">每周报告</option>
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={()=>{ setShowSubModal(false); setSubName(""); setSubQuery(""); setSubCompanies(""); setSubFreq("daily"); setSubAuthorities([]); }} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
                  <button onClick={createSubscription} disabled={!subName.trim()||!subQuery.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">创建监控</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
