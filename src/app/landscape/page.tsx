"use client";

/**
 * 🗺️ 技术布局页（v2 — 历史侧边栏 + 演示按钮 + 默认历史 + 丰富 Mock）
 *
 * 左侧 LandscapeHistorySidebar + 主内容区。
 * 搜索栏右侧「填入演示」按钮 → 自动填入"BEV感知"并触发。
 * /api/landscape 返回 landscape-bev.ts 丰富数据。
 */

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Loader2, TrendingUp, Trophy, Cloud, PieChart, Shield, Zap,
} from "lucide-react";
import { LandscapeHistorySidebar } from "@/components/landscape/LandscapeHistorySidebar";
import { AiAssistantPanel } from "@/components/shared/AiAssistantPanel";
import { usePatentPreview } from "@/lib/patent-preview-context";
import { DEFAULT_LANDSCAPE_HISTORY } from "@/fixtures/landscape-history-default";
import type { LandscapeHistoryItem, PatentSummary } from "@/lib/types";

/** localStorage 安全读 + fixture 初始化 */
function readLandscapeHistory(): LandscapeHistoryItem[] {
  try {
    const raw = localStorage.getItem("landscape-history");
    if (!raw) {
      localStorage.setItem("landscape-history", JSON.stringify(DEFAULT_LANDSCAPE_HISTORY));
      return DEFAULT_LANDSCAPE_HISTORY as LandscapeHistoryItem[];
    }
    return JSON.parse(raw) as LandscapeHistoryItem[];
  } catch {
    return DEFAULT_LANDSCAPE_HISTORY as LandscapeHistoryItem[];
  }
}
function saveLandscapeHistory(items: LandscapeHistoryItem[]) {
  try { localStorage.setItem("landscape-history", JSON.stringify(items)); } catch {}
}

const TABS = [
  { key: "trend" as const, label: "申请趋势", icon: TrendingUp },
  { key: "players" as const, label: "主要玩家", icon: Trophy },
  { key: "hotwords" as const, label: "技术热词", icon: Cloud },
  { key: "status" as const, label: "技术现状", icon: PieChart },
  { key: "competition" as const, label: "竞争格局", icon: Shield },
];
type TabKey = (typeof TABS)[number]["key"];

const DEMO_QUERY = "BEV感知";
const DEMO_QUERY_2 = "激光雷达";
const DEMO_QUERY_3 = "端到端自动驾驶";
const DEMO_FROM = 2018;
const DEMO_TO = 2025;
const DEMO_AUTHORITIES = ["CN","US","EP"];

export default function LandscapePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <LandscapePageInner />
    </Suspense>
  );
}

function LandscapePageInner() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(2025);
  const { openPreview } = usePatentPreview();
  const [authorities, setAuthorities] = useState<string[]>(["CN","US","EP"]);
  const [tab, setTab] = useState<TabKey>("trend");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 历史
  const [history, setHistory] = useState<LandscapeHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** 历史导航时抑制 tab useEffect 触发 saveHistory */
  const skipTabEffectRef = useRef(false);

  // 从 URL 参数初始化（首页历史跳转）
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      // 延迟触发搜索，确保 state 已更新
      setTimeout(() => {
        saveHistory(q);
        doSearch(q);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setHistory(readLandscapeHistory()); }, []);

  const saveHistory = (topic: string) => {
    const item: LandscapeHistoryItem = {
      id: `lh_${Date.now()}`,
      query: topic,
      from, to, authorities,
      tabsLoaded: [tab],
      createdAt: new Date().toISOString(),
    };
    const prev = readLandscapeHistory();
    const updated = [item, ...prev.filter((h) => h.query !== topic)].slice(0, 20);
    saveLandscapeHistory(updated);
    setHistory(updated);
  };

  const doSearch = useCallback(async (searchQuery: string, opts?: { skipSave?: boolean }) => {
    if (!searchQuery.trim()) return;
    setLoading(true); setSearched(true);
    if (!opts?.skipSave) saveHistory(searchQuery.trim());
    try {
      const res = await fetch(`/api/landscape?q=${encodeURIComponent(searchQuery.trim())}&tab=${tab}&from=${from}&to=${to}&authorities=${authorities.join(",")}`);
      const d = await res.json();
      setData(d.data); setSource(d.source ?? "mock");
    } catch { setData(null); } finally { setLoading(false); }
  }, [tab, from, to, authorities]);

  /** tab 切换时重新查询（历史导航时跳过 saveHistory，避免推到顶部） */
  useEffect(() => {
    if (!searched || !query.trim()) return;
    if (skipTabEffectRef.current) {
      skipTabEffectRef.current = false;
      doSearch(query, { skipSave: true });
    } else {
      doSearch(query);
    }
  }, [tab]);

  const handleSearch = () => doSearch(query);

  const [demoIndex, setDemoIndex] = useState(0);
  const demos = [DEMO_QUERY, DEMO_QUERY_2, DEMO_QUERY_3];
  const handleDemo = (variant?: number) => {
    const idx = variant ?? demoIndex;
    const q = demos[idx];
    setQuery(q);
    setFrom(DEMO_FROM);
    setTo(DEMO_TO);
    setAuthorities(DEMO_AUTHORITIES);
    doSearch(q);
    setDemoIndex((idx + 1) % 3);
  };

  const handleHistorySelect = (item: LandscapeHistoryItem) => {
    skipTabEffectRef.current = true; // 让 tab useEffect 以 skipSave 执行
    setQuery(item.query);
    setFrom(item.from); setTo(item.to);
    setAuthorities(item.authorities);
    // 设 tab 触发 useEffect → doSearch(query, {skipSave:true})，用最新 tab 值
    setTab(item.tabsLoaded[0] ?? "trend");
    setSearched(true);
  };

  /** 新增调研：清空结果回到初始态 */
  const handleNewResearch = () => {
    setQuery("");
    setData(null);
    setSearched(false);
  };

  const handleHistoryDelete = (idx: number) => {
    const updated = history.filter((_, i) => i !== idx);
    saveLandscapeHistory(updated);
    setHistory(updated);
  };

  return (
    <div className="flex h-full">
      {sidebarOpen && (
        <LandscapeHistorySidebar
          history={history}
          onSelect={handleHistorySelect}
          onDelete={handleHistoryDelete}
          activeQuery={query}
          onNewResearch={handleNewResearch}
        />
      )}
      <div className="flex-1 min-w-0 p-6 space-y-5 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold">🔬 技术调研 Copilot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            输入一个技术方向，获得：近5年专利申请趋势、主要玩家排名、高频技术词云、有效/失效/审中专利分布、主要竞品专利火力对比。
          </p>
        </div>

        {/* AI 助手 */}
        <AiAssistantPanel
          skillName="tech_research_planner"
          placeholder="例如：端到端自动驾驶近几年趋势，谁最厉害"
          onAction={(action) => {
            if (action.params.query) setQuery(String(action.params.query));
            if (action.params.from) setFrom(Number(action.params.from));
            if (action.params.to) setTo(Number(action.params.to));
            if (action.params.authorities) setAuthorities(action.params.authorities as string[]);
            if (action.autoSubmit) doSearch(String(action.params.query));
          }}
        />

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
            <input
              value={query} onChange={(e)=>setQuery(e.target.value)}
              onKeyDown={(e)=>e.key==="Enter"&&handleSearch()}
              placeholder="输入技术主题，如 BEV感知、激光雷达..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button onClick={handleSearch} disabled={loading||!query.trim()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Loader2 className="size-4 animate-spin"/> : <Search className="size-4"/>}分析
          </button>
          <button onClick={() => handleDemo()} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors" title="点击切换不同演示案例（共3个）">
            <Zap className="size-3.5"/>填入演示 ({demoIndex + 1}/3)
          </button>
        </div>

        {source==="mock"&&searched&&(
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-xs text-amber-700">⚠️ 当前为 Mock 数据</div>
        )}

        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 w-fit flex-wrap">
          {TABS.map((t)=>(<button key={t.key} onClick={()=>setTab(t.key)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab===t.key?"bg-white dark:bg-zinc-700 shadow-sm":"text-muted-foreground hover:text-foreground"}`}><t.icon className="size-3.5"/>{t.label}</button>))}
        </div>

        {!searched && (
          <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
            <Search className="size-8 text-muted-foreground mx-auto"/>
            <p className="text-sm text-muted-foreground">输入技术主题或点击「填入演示」开始分析</p>
          </div>
        )}
        {searched && loading && (
          <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground"/></div>
        )}

        {searched && !loading && data && (
          <>
            {tab === "trend" && (
              <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-blue-500"/>年度申请趋势</h3>
                {(() => { const d = data as { years?: number[]; applications?: number[]; grants?: number[]; byCn?: number[]; byUs?: number[]; byEp?: number[] }; if (!d.years) return <p className="text-sm text-muted-foreground">暂无数据</p>; const max = Math.max(...(d.applications??[]),1); return (
                  <div className="flex items-end gap-2 h-48">
                    {d.years.map((y,i)=>(<div key={y} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs font-medium text-muted-foreground">{(d.applications?.[i]??0).toLocaleString()}</span><div className="w-full rounded-t-md bg-blue-500/60" style={{height:`${((d.applications?.[i]??0)/max)*100}%`,minHeight:4}}/><span className="text-xs text-muted-foreground">{y}</span></div>))}
                  </div>
                ); })()}
              </div>
            )}

            {tab === "players" && (
              <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="size-4 text-amber-500"/>申请人 Top 10</h3>
                {(() => { const d = data as { ranking?: { name:string; count:number; yoy?:string; topIpc?:string }[] }; if (!d.ranking) return <p className="text-sm text-muted-foreground">暂无数据</p>; const max = Math.max(...d.ranking.map((p)=>p.count),1); return d.ranking.map((p,i)=>(<div key={p.name} className="flex items-center gap-3 text-sm"><span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0 ${i===0?"bg-amber-500 text-white":i===1?"bg-zinc-400 text-white":i===2?"bg-amber-700 text-white":"bg-zinc-200 text-zinc-600 dark:bg-zinc-700"}`}>{i+1}</span><span className="w-24 truncate text-xs">{p.name}</span><div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500/60 rounded-full" style={{width:`${(p.count/max)*100}%`}}/></div><span className="text-xs text-muted-foreground w-16 text-right">{p.count.toLocaleString()}</span>{p.yoy&&<span className="text-xs text-green-600">{p.yoy}</span>}</div>)); })()}
              </div>
            )}

            {tab === "hotwords" && (
              <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Cloud className="size-4 text-purple-500"/>技术热词</h3>
                {(() => { const d = data as { wordCloud?: { word:string; weight:number }[] }; if (!d.wordCloud) return <p className="text-sm text-muted-foreground">暂无数据</p>; const max = Math.max(...d.wordCloud.map((w)=>w.weight),1); return (
                  <div className="flex flex-wrap items-center justify-center gap-3 min-h-[120px]">
                    {d.wordCloud.map((item)=>{ const r = item.weight/max; const s = 0.7+r*1.3; const o = 0.4+r*0.6; return <span key={item.word} className="inline-block font-medium text-blue-600 dark:text-blue-400 transition-all hover:scale-110 cursor-default" style={{fontSize:`${s}rem`,opacity:o}}>{item.word}</span>; })}
                  </div>
                ); })()}
              </div>
            )}

            {tab === "status" && (
              <div className="space-y-4">
                {(() => { const d = data as { legalStatus?: Record<string,number>; topCited?: { pn:string; title:string; assignee:string; citedCount:number }[] }; return (<>
                  {d.legalStatus && (
                    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
                      <h3 className="text-sm font-semibold">法律状态分布</h3>
                      <div className="flex items-center gap-6">
                        {Object.entries(d.legalStatus).map(([k,v])=>(<div key={k} className="text-center"><div className={`size-16 rounded-full border-4 mx-auto flex items-center justify-center ${k==="active"?"border-green-500":k==="expired"?"border-zinc-400":"border-blue-500"}`}><span className="text-lg font-bold">{v}%</span></div><p className="text-xs text-muted-foreground mt-2">{k==="active"?"有效":k==="expired"?"失效":"申请中"}</p></div>))}
                      </div>
                    </div>
                  )}
                  {d.topCited && (
                    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-3">
                      <h3 className="text-sm font-semibold">被引最多 Top 5</h3>
                      {d.topCited.map((p,i)=>(<div key={p.pn} className="flex items-center gap-3 text-sm rounded p-1.5 -mx-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/20"><span className="text-xs font-bold text-muted-foreground w-5">{i+1}</span><div className="flex-1 min-w-0"><p className="text-sm truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.assignee} · {p.pn}</p></div><span className="text-xs text-muted-foreground">被引 {p.citedCount} 次</span><button type="button" onClick={(e) => { e.stopPropagation(); openPreview({ patentId: p.pn, pn: p.pn, apno: "", title: p.title, originalAssignee: p.assignee, currentAssignee: "", inventor: "", apdt: 0, pbdt: 0, authority: "" }); }} className="ml-1 shrink-0 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900">📄 预览</button></div>))}
                    </div>
                  )}
                </>); })()}
              </div>
            )}

            {tab === "competition" && (
              <div className="space-y-4">
                {(() => { const d = data as { hhi?:number; dominantPlayer?:string; competitionLevel?:string; whiteSpaces?:{ area:string; reason:string }[]; barriers?:{ area:string; reason:string }[] }; return (<>
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="size-4 text-orange-500"/>竞争壁垒分析</h3>
                    <div className="flex items-center gap-6">
                      <div className="text-center"><div className={`text-4xl font-bold ${(d.hhi??0)>0.2?"text-red-600":(d.hhi??0)>0.1?"text-amber-600":"text-green-600"}`}>{((d.hhi??0)*100).toFixed(1)}%</div><p className="text-xs text-muted-foreground mt-1">HHI 集中度</p></div>
                      <div className="text-xs text-muted-foreground">主导玩家：{d.dominantPlayer??"未知"} · 竞争水平：{d.competitionLevel??"未知"}</div>
                    </div>
                  </div>
                  {d.whiteSpaces && d.whiteSpaces.length > 0 && (
                    <div className="rounded-lg border bg-white dark:bg-zinc-900 p-5 space-y-3">
                      <h3 className="text-sm font-semibold">低竞争密度方向（空白区）</h3>
                      {d.whiteSpaces.map((w)=>(<div key={w.area} className="p-3 rounded-lg bg-green-50 dark:bg-green-950"><p className="text-sm font-medium text-green-800 dark:text-green-200">{w.area}</p><p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{w.reason}</p></div>))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">此分析基于申请人排名数据自动计算（HHI 指数 + 份额分布）</p>
                </>); })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
