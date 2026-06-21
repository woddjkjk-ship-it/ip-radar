"use client";

/**
 * 🔍 专利检索页（v2 — 4 模式 + 演示按钮 + 默认历史 + 专利号 Tab）
 *
 * 模式 Tab：关键词 / 语义 / 企业 / 专利号
 * 每个 Tab 右上角「填入演示」按钮 → 自动填入并触发搜索
 * 左侧历史栏：空值时用 fixture 初始化 5 条
 */

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  X,
  Clock,
  Trash2,
  History,
  Filter,
  Plus,
  Zap,
} from "lucide-react";
import { PatentCard } from "@/components/shared/PatentCard";
import { usePatentPreview } from "@/lib/patent-preview-context";
import { AiAssistantPanel } from "@/components/shared/AiAssistantPanel";
import { logStore } from "@/lib/log-store";
import { DEFAULT_SEARCH_HISTORY } from "@/fixtures/search-history-default";
import type { PatentSummary, SearchHistoryItem } from "@/lib/types";

/** localStorage 安全读 + fixture 初始化 */
function readSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem("patent-search-history");
    if (!raw) {
      // 空值初始化
      localStorage.setItem("patent-search-history", JSON.stringify(DEFAULT_SEARCH_HISTORY));
      return DEFAULT_SEARCH_HISTORY as SearchHistoryItem[];
    }
    return JSON.parse(raw) as SearchHistoryItem[];
  } catch {
    return DEFAULT_SEARCH_HISTORY as SearchHistoryItem[];
  }
}

function saveSearchHistory(items: SearchHistoryItem[]) {
  try {
    localStorage.setItem("patent-search-history", JSON.stringify(items));
  } catch { /* ignore */ }
}

// ── 演示文本 ──
const DEMO_KEYWORD = "时空注意力 传感器融合 多模态感知";
const DEMO_KEYWORD_2 = "端到端规划 BEV";
const DEMO_KEYWORD_3 = "激光雷达 点云分割 目标检测";
const DEMO_SEMANTIC =
  "一种基于多传感器融合的自动驾驶环境感知技术方案。利用 Transformer 架构实现跨模态时空注意力机制，对摄像头、激光雷达、毫米波雷达特征进行自适应对齐融合。引入时序注意力轨迹建模，使动态目标位置预测误差降低 23%。通过知识蒸馏将推理延迟从 120ms 压缩至 28ms，满足车规实时性要求。";
const DEMO_COMPANY = "Waymo";
const DEMO_PN = "US20240123456A1\nCN116994312A\nEP4189620B1";


export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [pnLines, setPnLines] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic" | "company" | "pn">("keyword");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PatentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  // 高级筛选
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [apdStart, setApdStart] = useState("");
  const [apdEnd, setApdEnd] = useState("");
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [legalStatus, setLegalStatus] = useState("");

  // 选择 + 抽屉
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { openPreview } = usePatentPreview();

  // 建议
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 历史
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 从 URL 参数初始化（首页历史跳转）
  useEffect(() => {
    const q = searchParams.get("q");
    const m = searchParams.get("mode");
    if (q) {
      const validMode = (m === "keyword" || m === "semantic" || m === "company" || m === "pn")
        ? m : "keyword";
      if (validMode === "pn") {
        setPnLines(q.replace(/, /g, "\n"));
      } else {
        setQuery(q);
      }
      setMode(validMode);
      // 延迟触发搜索，确保 state 已更新
      setTimeout(() => {
        setSearched(true);
        setLoading(true);
        doSearch(q, validMode);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载历史（含 fixture 初始化）
  useEffect(() => {
    setHistory(readSearchHistory());
  }, []);

  // P070 建议（debounce 300ms）
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!val.trim() || mode !== "keyword") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(val.trim())}`);
        const d = await res.json();
        setSuggestions(d.suggestions ?? []);
        setShowSuggestions((d.suggestions ?? []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  // 执行检索
  const doSearch = useCallback(
    async (searchQuery: string, searchMode: typeof mode, opts?: { skipSave?: boolean }) => {
      const skipSave = opts?.skipSave ?? false;
      if (searchMode === "pn") {
        // 专利号模式：优先用 searchQuery（如 AI 助手传入），否则用 pnLines
        const raw = searchQuery.trim() || pnLines;
        const pns = raw
          .split(/[,\n]/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (pns.length === 0) return;
        setLoading(true);
        setSearched(true);
        setShowSuggestions(false);
        try {
          const params = new URLSearchParams({ mode: "pn", q: pns.join(",") });
          if (authorities.length) params.set("authority", authorities.join(","));
          const res = await fetch(`/api/search?${params.toString()}`);
          const d = await res.json();
          setResults((d.results ?? []) as PatentSummary[]);
          setTotal(d.total ?? 0);
          if (!skipSave) saveSearchHistoryItem(pns.join(", ").slice(0, 50), "pn", d.total ?? 0);
          const ep = (d._endpoint as string) ?? "P069";
          logStore.append({
            type: "api", title: `${ep} 专利号检索`, action: `${pns.length} 个专利号`, result: `共 ${d.total ?? 0} 条`,
            fullResponse: { endpoint: ep, total: d.total, resultsCount: (d.results as unknown[])?.length ?? 0 },
          });
        } catch {
          setResults([]);
          setTotal(0);
          logStore.append({ type: "api", title: "专利号检索失败", action: pns.join(", ").slice(0, 80) });
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!searchQuery.trim()) return;
      setLoading(true);
      setSearched(true);
      setShowSuggestions(false);

      try {
        const params = new URLSearchParams({ q: searchQuery.trim(), mode: searchMode, limit: "20" });
        if (apdStart) params.set("apd_start", apdStart);
        if (apdEnd) params.set("apd_end", apdEnd);
        if (authorities.length) params.set("authority", authorities.join(","));
        if (assignee) params.set("assignee", assignee);
        if (legalStatus) params.set("legal_status", legalStatus);

        const res = await fetch(`/api/search?${params.toString()}`);
        const d = await res.json();
        setResults((d.results ?? []) as PatentSummary[]);
        setTotal(d.total ?? 0);
        if (!skipSave) saveSearchHistoryItem(searchQuery.trim(), searchMode, d.total ?? 0);
        const ep = (d._endpoint as string) ?? "P002";
        const modeLabel = { keyword: "关键词检索", semantic: "语义检索", company: "企业检索", pn: "专利号检索" }[searchMode];
        logStore.append({
          type: "api", title: `${ep} ${modeLabel}`, action: searchQuery.trim().slice(0, 80), result: `共 ${d.total ?? 0} 条`,
          fullResponse: { endpoint: ep, mode: searchMode, total: d.total, resultsCount: (d.results as unknown[])?.length ?? 0 },
        });
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [pnLines, apdStart, apdEnd, authorities, assignee, legalStatus],
  );

  const saveSearchHistoryItem = (q: string, m: typeof mode, rc: number) => {
    const item: SearchHistoryItem = {
      id: `sh_${Date.now()}`,
      query: q,
      mode: m,
      resultCount: rc,
      createdAt: new Date().toISOString(),
    };
    const prev = readSearchHistory();
    const updated = [item, ...prev.filter((h) => h.query !== q)].slice(0, 20);
    saveSearchHistory(updated);
    setHistory(updated);
  };

  const handleSearch = () => doSearch(query, mode);

  const handleHistoryClick = (item: SearchHistoryItem) => {
    setMode(item.mode);
    if (item.mode === "pn") {
      setPnLines(item.query.replace(/, /g, "\n"));
    } else {
      setQuery(item.query);
    }
    // skipSave: 保持该项在历史列表中的原位，不弹到顶部
    doSearch(item.query, item.mode, { skipSave: true });
  };

  /** 新增检索：清空结果回到初始态 */
  const handleNewSearch = () => {
    setQuery("");
    setPnLines("");
    setResults([]);
    setTotal(0);
    setSearched(false);
    setSelected(new Set());
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleDeleteHistory = (idx: number) => {
    const updated = history.filter((_, i) => i !== idx);
    saveSearchHistory(updated);
    setHistory(updated);
  };

  // 切换到专利号模式
  const switchToPnMode = () => setMode("pn");

  // 复选框
  const toggleSelect = (patentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(patentId) ? next.delete(patentId) : next.add(patentId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((r) => r.patentId)));
  };

  const addSelectedToFto = () => {
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("fto-pending-patents") ?? "[]");
      for (const id of selected) {
        if (!prev.includes(id)) prev.unshift(id);
      }
      localStorage.setItem("fto-pending-patents", JSON.stringify(prev.slice(0, 20)));
    } catch { /* ignore */ }
  };

  const toggleAuthority = (a: string) => {
    setAuthorities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  // 演示填入（支持 3 个可选案例）+ 自动触发搜索
  const [demoIdx, setDemoIdx] = useState(0);
  const fillDemo = (variant?: number) => {
    const idx = variant ?? demoIdx;
    let demoQuery = "";
    if (mode === "keyword") {
      demoQuery = idx === 0 ? DEMO_KEYWORD : idx === 1 ? DEMO_KEYWORD_2 : DEMO_KEYWORD_3;
      setQuery(demoQuery);
    } else if (mode === "semantic") {
      demoQuery = DEMO_SEMANTIC;
      setQuery(demoQuery);
    } else if (mode === "company") {
      demoQuery = DEMO_COMPANY;
      setQuery(demoQuery);
    } else if (mode === "pn") {
      setPnLines(DEMO_PN);
    }
    setDemoIdx((idx + 1) % 3);
    // 填入后自动触发搜索。pn 模式依赖 pnLines state 更新，需等一次 tick；
    // 其他模式直接用本地变量 demoQuery 传参，不依赖 state 同步。
    if (mode === "pn") {
      setTimeout(() => doSearch("", "pn"), 0);
    } else if (demoQuery) {
      doSearch(demoQuery, mode);
    }
  };

  const TABS = [
    { key: "keyword" as const, label: "关键词检索" },
    { key: "semantic" as const, label: "语义检索" },
    { key: "company" as const, label: "企业检索" },
    { key: "pn" as const, label: "专利号检索" },
  ];

  return (
    <div className="flex h-full">
      {/* 左侧历史栏 */}
      {sidebarOpen && (
        <aside className="w-60 shrink-0 border-r bg-white dark:bg-zinc-950 p-3 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <History className="size-3.5" />
              搜索历史
            </h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无记录</p>
          ) : (
            <div className="space-y-1">
              {history.slice(0, 30).map((item, i) => {
                /** PN 模式用 pnLines 对比，其他模式用 query */
                const isActive = item.mode === mode && (
                  item.mode === "pn"
                    ? item.query === pnLines.replace(/\n/g, ", ")
                    : item.query === query
                );
                return (
                <div
                  key={item.id ?? i}
                  className={`group relative rounded-lg p-2 cursor-pointer ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <button
                    onClick={() => handleHistoryClick(item)}
                    className="w-full text-left"
                  >
                    <p className="text-xs truncate">{item.query}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {item.resultCount} 条 · {item.mode}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteHistory(i);
                    }}
                    className="absolute right-1.5 top-1.5 hidden group-hover:inline-flex text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
          {/* 新增检索按钮 */}
          <button
            onClick={handleNewSearch}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shrink-0"
          >
            <Plus className="size-3.5" />
            新增检索
          </button>
        </aside>
      )}

      {/* 主内容 */}
      <div className="flex-1 min-w-0 p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🔍 专利检索</h1>
            <p className="text-sm text-muted-foreground mt-1">
              4 种模式检索全球专利数据库
            </p>
          </div>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Clock className="size-3" />
              历史
            </button>
          )}
        </div>

        {/* AI 助手 */}
        <AiAssistantPanel
          skillName="smart_patent_search"
          placeholder="例如：特斯拉纯视觉感知最新专利 / CN116994312A 是什么"
          onAction={(action) => {
            if (action.tab) {
              // 切换到对应 Tab
              const tabKey = action.tab as "keyword" | "semantic" | "company" | "pn";
              setMode(tabKey);
            }
            if (action.params.query) setQuery(String(action.params.query));
            if (action.params.text) setQuery(String(action.params.text));
            if (action.params.company) {
              // 企业检索：query = 企业名；keyword 用于后续筛选（如 API 支持），不覆盖
              setQuery(String(action.params.company));
            }
            if (action.params.pns) {
              // PN 模式使用 pnLines（textarea），不是 query（input）
              setPnLines(String(action.params.pns));
            }
            if (action.autoSubmit) {
              setTimeout(() => {
                if (action.tab === "pn" || action.params.pns) {
                  // PN 模式：doSearch 现在支持 searchQuery 参数
                  const pns = String(action.params.pns ?? "");
                  if (pns.trim()) doSearch(pns, "pn");
                } else {
                  document.querySelector<HTMLButtonElement>('[data-search-btn]')?.click();
                }
              }, 150);
            }
          }}
        />

        {/* 检索模式 Tab + 演示按钮 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setMode(t.key);
                  setSearched(false);
                  setResults([]);
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === t.key
                    ? "bg-white dark:bg-zinc-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fillDemo()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-blue-300 transition-colors"
            title="点击切换不同演示案例（共3个）"
          >
            <Zap className="size-3" />
            填入演示 {mode === "keyword" ? `(${demoIdx + 1}/3)` : ""}
          </button>
        </div>

        {/* 搜索框 / 专利号输入 */}
        {mode !== "pn" ? (
          <div className="relative">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={
                    mode === "keyword"
                      ? '例: TACD: "sensor fusion" AND lidar'
                      : mode === "semantic"
                        ? "输入技术描述文本（建议 200 字以上）"
                        : "输入企业名称，如 Tesla"
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-white dark:bg-zinc-900 shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQuery(s);
                          setShowSuggestions(false);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                data-search-btn
                disabled={loading || !query.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                检索
              </button>
            </div>
          </div>
        ) : (
          /* 专利号模式：textarea */
          <div className="space-y-3">
            <textarea
              value={pnLines}
              onChange={(e) => setPnLines(e.target.value)}
              placeholder="每行输入一个专利号，如：\nUS20240123456A1\nCN116994312A\nEP4189620B1"
              rows={4}
              className="w-full rounded-lg border border-input bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => {
                const pns = pnLines
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean);
                if (pns.length === 0) return;
                doSearch("", "pn");
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              检索
            </button>
          </div>
        )}

        {/* 高级筛选 */}
        <div>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Filter className="size-3" />
            高级筛选
            {filtersOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {filtersOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-lg border bg-white dark:bg-zinc-900">
              <div>
                <label className="text-xs font-medium">申请日（起）</label>
                <input
                  type="text"
                  placeholder="YYYYMMDD"
                  value={apdStart}
                  onChange={(e) => setApdStart(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium">申请日（止）</label>
                <input
                  type="text"
                  placeholder="YYYYMMDD"
                  value={apdEnd}
                  onChange={(e) => setApdEnd(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium">受理局</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {["CN", "US", "EP", "JP"].map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAuthority(a)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        authorities.includes(a)
                          ? "bg-blue-100 text-blue-700 border-blue-300"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">申请人</label>
                <input
                  type="text"
                  placeholder="企业名称"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium">法律状态</label>
                <select
                  value={legalStatus}
                  onChange={(e) => setLegalStatus(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">全部</option>
                  <option value="active">有效</option>
                  <option value="expired">失效</option>
                  <option value="pending">申请中</option>
                </select>
              </div>
              {/* 确认筛选按钮 */}
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  className="px-5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                >
                  确认筛选
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 结果 */}
        {searched && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? "检索中..." : `共 ${total} 条结果`}
              </p>
              {results.length > 0 && (
                <div className="flex items-center gap-3">
                  <button onClick={toggleSelectAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {selected.size === results.length ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                    全选
                  </button>
                  {selected.size > 0 && (
                    <button onClick={addSelectedToFto} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      加入 FTO 分析（{selected.size}）
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {results.map((p) => (
                <div key={p.patentId} className="flex items-start gap-2">
                  <button onClick={() => toggleSelect(p.patentId)} className="mt-4 shrink-0 text-muted-foreground hover:text-foreground">
                    {selected.has(p.patentId) ? <CheckSquare className="size-4 text-blue-600" /> : <Square className="size-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <PatentCard
                      patent={p}
                      onClick={() => openPreview(p)}
                    />
                  </div>
                </div>
              ))}
              {!loading && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  未找到匹配结果
                </p>
              )}
            </div>
          </div>
        )}

        {!searched && (
          <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
            <Search className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">选择检索模式并输入查询内容，或点击「填入演示」快速体验</p>
          </div>
        )}

      </div>
    </div>
  );
}
