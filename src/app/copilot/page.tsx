"use client";

/**
 * Copilot 主页面 — FTO Copilot（全阶段持久化版）
 *
 * 双栏布局：左侧 FtoHistorySidebar + 右侧主内容区。
 * 阶段：input → step1_running → hitl_wait → steps2_4_running → done
 *
 * v3 改动：全阶段 sessionStorage 持久化。
 * - 切页回来能恢复 hitl_wait（要素卡还在）
 * - 切页回来能恢复 done（报告还在）
 * - 运行中被中断（step1_running / steps2_4_running）→ 显示中断提示 + 重新运行
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { logStore } from "@/lib/log-store";
import type { StepRecord } from "@/lib/session/types";
import { WelcomeCard } from "@/components/copilot/WelcomeCard";
import { usePatentPreview } from "@/lib/patent-preview-context";
import { HorizontalStepper } from "@/components/copilot/HorizontalStepper";
import { TechSummaryCard } from "@/components/copilot/TechSummaryCard";
import { RiskCard } from "@/components/copilot/RiskCard";
import { ReportPreview } from "@/components/copilot/ReportPreview";
import { ResultVerdictCard } from "@/components/copilot/ResultVerdictCard";
import { NextActionsCard } from "@/components/copilot/NextActionsCard";
import { FtoHistorySidebar } from "@/components/copilot/FtoHistorySidebar";
import { StepDetailDrawer } from "@/components/copilot/StepDetailDrawer";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { TechElements, RiskAssessment, PatentSummary, FtoHistoryItem, FtoReport } from "@/lib/types";

function safeReadJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}
function saveToLocalStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

interface StepUI {
  status: string; name: string; duration?: string; stepRecord?: StepRecord;
}
type Phase = "input" | "step1_running" | "hitl_wait" | "steps2_4_running" | "done";

const PERSIST_KEY = "copilot-current-session";

/** 持久化结构：全部运行时状态 */
interface PersistedState {
  phase: Phase;
  sessionId: string | null;
  steps: Record<number, StepUI>;
  elements: TechElements | null;
  topPatents: (PatentSummary & { relevancyReason?: string })[] | null;
  assessments: RiskAssessment[] | null;
  report: FtoReport | null;
  reportMarkdown: string;
  inputText: string;
  inputCompetitors: string[];
}

export default function CopilotPage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<number, StepUI>>({
    1: { status: "pending", name: "技术理解" },
    2: { status: "pending", name: "专利检索" },
    3: { status: "pending", name: "风险评估" },
    4: { status: "pending", name: "报告生成" },
  });

  const [elements, setElements] = useState<TechElements | null>(null);
  const [topPatents, setTopPatents] = useState<(PatentSummary & { relevancyReason?: string })[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [report, setReport] = useState<FtoReport | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState("");

  // 保存原始输入（用于中断后重新运行）
  const [inputText, setInputText] = useState("");
  const [inputCompetitors, setInputCompetitors] = useState<string[]>([]);

  const [history, setHistory] = useState<FtoHistoryItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStep, setDetailStep] = useState<StepRecord | undefined>();

  // ── PatentModal（专利预览）──
  const { openPreview } = usePatentPreview();

  const savedRef = useRef(false);
  const elementsRef = useRef<TechElements | null>(null);
  // 防抖 persist timer
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 当前 UI 正在展示的 sessionId（用于防止旧轮询覆盖当前视图）
  const currentSessionRef = useRef<string | null>(null);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => {
    const raw = safeReadJson<FtoHistoryItem[]>("fto-history", []);
    let modified = false;
    const now = Date.now();
    const THIRTY_MIN = 30 * 60 * 1000;
    const cleaned = raw.map((h) => {
      // 超过 30 分钟仍在 running → 标记为 completed（降级）
      if (h.status === "running") {
        const age = now - new Date(h.createdAt).getTime();
        if (age > THIRTY_MIN) {
          modified = true;
          return { ...h, status: "completed" as const, stats: { ...h.stats, total: h.stats.total || 1 } };
        }
      }
      return h;
    });
    if (modified) {
      saveToLocalStorage("fto-history", cleaned);
    }
    setHistory(cleaned);
  }, []);

  // ── 持久化：每次关键状态变化时写入 sessionStorage ──
  const persistState = useCallback(() => {
    try {
      const state: PersistedState = {
        phase, sessionId, steps,
        elements, topPatents: topPatents.length > 0 ? topPatents : null,
        assessments: assessments.length > 0 ? assessments : null,
        report, reportMarkdown,
        inputText, inputCompetitors,
      };
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [phase, sessionId, steps, elements, topPatents, assessments, report, reportMarkdown, inputText, inputCompetitors]);

  // 防抖写（SSE 高频更新时避免频繁序列化）
  const debouncedPersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(persistState, 150);
  }, [persistState]);

  // 阶段变更立即写；运行中每个 SSE event 走防抖
  useEffect(() => { persistState(); }, [phase, persistState]);
  useEffect(() => { if (phase === "step1_running" || phase === "steps2_4_running") debouncedPersist(); }, [steps, topPatents, assessments, reportMarkdown, phase, debouncedPersist]);

  // ── 组件卸载时清理轮询和防抖计时器，防止内存泄漏和 setState-after-unmount ──
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = undefined;
      }
    };
  }, []);

  // ── 挂载时恢复 ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const s: PersistedState = JSON.parse(raw);

      // 恢复持久化字段
      setSessionId(s.sessionId ?? null);
      setSteps(s.steps ?? { 1:{status:"pending",name:"技术理解"},2:{status:"pending",name:"专利检索"},3:{status:"pending",name:"风险评估"},4:{status:"pending",name:"报告生成"} });
      setInputText(s.inputText ?? "");
      setInputCompetitors(s.inputCompetitors ?? []);

      if (s.phase === "done") {
        // 优先从 fto-history 恢复报告（sessionStorage 可能因切换会话丢失 report 对象）
        const ftoItems = safeReadJson<FtoHistoryItem[]>("fto-history", []);
        const historyItem = s.sessionId ? ftoItems.find((h) => h.id === s.sessionId) : null;
        const restoredReport = s.report ?? (historyItem?.reportJson ? (() => { try { return JSON.parse(historyItem.reportJson); } catch { return null; } })() : null);
        const restoredMarkdown = s.reportMarkdown || historyItem?.reportJson || "";

        setPhase("done");
        setSessionId(s.sessionId ?? null);
        currentSessionRef.current = s.sessionId ?? null;
        setReport(restoredReport);
        setReportMarkdown(restoredMarkdown);
        if (s.elements) { setElements(s.elements); elementsRef.current = s.elements; }
        if (s.topPatents) setTopPatents(s.topPatents);
        if (s.assessments) setAssessments(s.assessments);
        return;
      }

      if (s.phase === "hitl_wait" && s.elements) {
        setPhase("hitl_wait");
        setElements(s.elements);
        elementsRef.current = s.elements;
        return;
      }

      // step1_running / steps2_4_running：后台任务持续运行 → 重连轮询
      if (s.phase === "step1_running" || s.phase === "steps2_4_running") {
        setPhase(s.phase);
        if (s.elements) { setElements(s.elements); elementsRef.current = s.elements; }
        if (s.topPatents) setTopPatents(s.topPatents);
        if (s.assessments) setAssessments(s.assessments);
        if (s.reportMarkdown) setReportMarkdown(s.reportMarkdown);
        if (s.report) setReport(s.report);
        // 启动轮询重连
        if (s.sessionId) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = setInterval(() => pollSession(s.sessionId!, s.phase), 2000);
        }
        return;
      }
    } catch { /* ignore */ }
  }, []);

  const updateStep = useCallback((stepNum: number, update: Partial<StepUI>) => {
    setSteps((prev) => ({ ...prev, [stepNum]: { ...prev[stepNum], ...update } }));
  }, []);

  /** 将 StepRecord 中的 LLM/API 调用同步到 LogStore */
  const syncStepToLogStore = useCallback((sr?: StepRecord) => {
    if (!sr) return;
    for (const llm of sr.llmCalls) {
      logStore.append({
        type: "llm",
        title: `DeepSeek — ${sr.name}`,
        action: `${llm.provider} ${llm.role} 调用`,
        params: `tokens: ${llm.usage?.promptTokens ?? "?"}+${llm.usage?.completionTokens ?? "?"}  ·  ${llm.latencyMs}ms`,
        result: llm.parsedOutput ? "解析成功" : llm.error ? `失败: ${llm.error}` : "",
        fullRequest: llm.promptMessages,
        fullResponse: llm.rawResponse,
      });
    }
    for (const api of sr.apiCalls) {
      logStore.append({
        type: "api",
        title: `${api.endpoint} ${api.provider === "patsnap" ? "Live" : "Mock"}`,
        action: `${api.endpoint} 调用 · ${api.latencyMs}ms`,
        params: JSON.stringify(api.request),
        result: api.error ? `失败: ${api.error}` : "成功",
        fullRequest: api.request,
        fullResponse: api.response,
      });
    }
  }, []);

  /** 保存/更新 fto-history 中的条目 */
  const upsertHistoryItem = useCallback(
    (item: FtoHistoryItem) => {
      const prev = safeReadJson<FtoHistoryItem[]>("fto-history", []);
      const filtered = prev.filter((h) => h.id !== item.id);
      const updated = [item, ...filtered].slice(0, 20);
      saveToLocalStorage("fto-history", updated);
      setHistory(updated);
    }, [],
  );

  const saveToHistoryOnce = useCallback(
    (r: FtoReport, el: TechElements, sid: string) => {
      if (savedRef.current) return;
      savedRef.current = true;
      const item: FtoHistoryItem = {
        id: sid, title: r.title,
        keywords: el.keywords.slice(0, 5),
        riskLevel: r.riskLevel,
        stats: { total: r.stats.totalPatents, high: r.stats.highRisk, medium: r.stats.mediumRisk },
        createdAt: new Date().toISOString(),
        reportJson: JSON.stringify(r),
        status: "completed",
      };
      upsertHistoryItem(item);
    }, [upsertHistoryItem],
  );

  // ── 轮询 session 状态（后台任务持久化）──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 从 GET /api/copilot/session/[id] 拉取最新状态并同步 UI */
  const pollSession = useCallback(async (sid: string, currentPhase: string, modifiedEl?: TechElements) => {
    // 如果 UI 正在展示其他会话，忽略本次轮询结果（防止覆盖）
    if (currentSessionRef.current && sid !== currentSessionRef.current) return;
    try {
      const res = await fetch(`/api/copilot/session/${sid}`);
      if (!res.ok) {
        // 会话已过期 → 标记 history 为 completed 并停止轮询
        const prev = safeReadJson<FtoHistoryItem[]>("fto-history", []);
        const updated = prev.map((h) => h.id === sid ? { ...h, status: "completed" as const, stats: { ...h.stats, total: h.stats.total || 1 } } : h);
        saveToLocalStorage("fto-history", updated);
        setHistory(updated);
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        setPhase("done");
        setReportMarkdown("⚠️ 该分析会话已过期，请新建分析。");
        return;
      }
      const s = await res.json();
      if (!s?.steps) return;

      // 同步步骤状态
      const newSteps: Record<number, StepUI> = { ...steps };
      for (const num of [1, 2, 3, 4]) {
        const sr = s.steps[num];
        if (!sr) continue;
        const dur = sr.startedAt && sr.finishedAt
          ? `${(new Date(sr.finishedAt).getTime() - new Date(sr.startedAt).getTime())}ms` : undefined;
        newSteps[num] = { status: sr.status, name: sr.name, stepRecord: sr, duration: dur };
        if (sr.status !== "pending") syncStepToLogStore(sr);
      }
      setSteps(newSteps);

      // 根据步骤状态推导 phase
      const s1 = s.steps[1]; const s2 = s.steps[2]; const s3 = s.steps[3]; const s4 = s.steps[4];

      // Step 1 完成 + HITL 等待
      if (s1?.status === "success" && s2?.status === "pending" && currentPhase === "step1_running") {
        if (s1.output?.elements) {
          setElements(s1.output.elements);
          elementsRef.current = s1.output.elements;
        }
        setPhase("hitl_wait");
        return;
      }

      // 仍在 Step 1 运行中
      if (s1?.status === "running") {
        setPhase("step1_running");
        return;
      }

      // Steps 2-4 运行中
      if (s2?.status === "running" || s3?.status === "running" || (s2?.status === "success" && s4?.status !== "success" && s4?.status !== "error")) {
        // 提取 Step 2 输出
        if (s2?.status === "success" && s2.output?.topPatents) {
          setTopPatents(s2.output.topPatents);
        }
        // 提取 Step 3 输出
        if (s3?.status === "success" && s3.output?.assessments) {
          setAssessments(s3.output.assessments);
        }
        setPhase("steps2_4_running");
        return;
      }

      // Step 4 完成
      if (s4?.status === "success") {
        // 提取 Step 2 & 3 数据
        if (s2?.output?.topPatents) setTopPatents(s2.output.topPatents);
        if (s3?.output?.assessments) setAssessments(s3.output.assessments);
        // 提取报告
        const out4 = s4.output;
        const rawMarkdown = out4?.markdown ?? s.reportContent ?? "";
        if (rawMarkdown) setReportMarkdown(rawMarkdown);
        let parsedReport: FtoReport | null = null;
        try {
          const parsed = JSON.parse(rawMarkdown);
          if (parsed && typeof parsed === "object" && "riskLevel" in parsed) {
            parsedReport = parsed as FtoReport;
            setReport(parsedReport);
          }
        } catch { /* markdown fallback — report stays as raw text */ }

        // 立即持久化到 localStorage/fto-history（即使 JSON 解析失败也保存原始内容）
        const el = elementsRef.current ?? modifiedEl;
        if (sid && el) {
          const r = parsedReport;
          const existing = safeReadJson<FtoHistoryItem[]>("fto-history", []);
          const alreadySaved = existing.some((h) => h.id === sid && h.status === "completed");
          if (!alreadySaved) {
            const item: FtoHistoryItem = {
              id: sid,
              title: r?.title ?? el.problem?.slice(0, 50) ?? "FTO 分析报告",
              keywords: el.keywords?.slice(0, 5) ?? [],
              riskLevel: r?.riskLevel ?? "medium",
              stats: r?.stats
                ? { total: r.stats.totalPatents, high: r.stats.highRisk, medium: r.stats.mediumRisk }
                : { total: (s2?.output?.topPatents as unknown[] ?? []).length || 1, high: 0, medium: 0 },
              createdAt: new Date().toISOString(),
              reportJson: r ? JSON.stringify(r) : rawMarkdown,
              status: "completed",
            };
            const updated = [item, ...existing.filter((h) => h.id !== sid)].slice(0, 20);
            saveToLocalStorage("fto-history", updated);
            setHistory(updated);
            savedRef.current = true;
          }
        }

        setPhase("done");
        // 停止轮询
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        return;
      }

      // 出错
      if (s1?.status === "error" || s2?.status === "error" || s3?.status === "error" || s4?.status === "error") {
        setPhase("done");
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        return;
      }

      // 维持当前 phase
      setPhase(currentPhase as typeof phase);
    } catch { /* ignore */ }
  }, [steps, updateStep, saveToHistoryOnce]);

  // ── Phase 1：Step 1（后台启动 + 轮询）──
  const handleSubmit = useCallback(async (text: string, competitors: string[], _imageRef?: string) => {
    logStore.append({ type: "system", title: "FTO 会话启动", action: `技术方案分析 · Mock 模式` });
    setPhase("step1_running");
    savedRef.current = false;
    setInputText(text);
    setInputCompetitors(competitors);
    setReport(null); setReportMarkdown("");
    setAssessments([]); setTopPatents([]); setElements(null);
    setSteps({ 1:{status:"running",name:"技术理解"},2:{status:"pending",name:"专利检索"},3:{status:"pending",name:"风险评估"},4:{status:"pending",name:"报告生成"} });

    try {
      const res = await fetch("/api/copilot/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, competitors }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sid = data.sessionId as string;
      setSessionId(sid);
      currentSessionRef.current = sid;

      // 立即写 running placeholder 到 fto-history
      upsertHistoryItem({
        id: sid,
        title: text.slice(0, 50),
        keywords: competitors.slice(0, 5),
        riskLevel: "low",
        stats: { total: 0, high: 0, medium: 0 },
        createdAt: new Date().toISOString(),
        reportJson: "",
        status: "running",
      });

      // 启动轮询
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => pollSession(sid, "step1_running"), 2000);
    } catch { updateStep(1, { status: "error" }); setPhase("done"); }
  }, [updateStep, pollSession, upsertHistoryItem]);

  // ── Phase 2：Steps 2-4（后台启动 + 轮询）──
  const handleHitlConfirm = useCallback(async (modified: TechElements) => {
    if (!sessionId) return;
    logStore.append({ type: "system", title: "FTO 会话", action: "用户确认技术要素，启动 Step 2-4" });
    setPhase("steps2_4_running");
    setSteps((prev) => ({ ...prev, 1: { ...prev[1], status: "success" }, 2: { status: "running", name: "专利检索" } }));
    try {
      const res = await fetch("/api/copilot/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, confirmedElements: modified }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 启动轮询
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => pollSession(sessionId, "steps2_4_running", modified), 2000);
    } catch { for (const num of [2,3,4]) { if (steps[num].status === "running") { updateStep(num, { status: "error" }); break; } } setPhase("done"); }
  }, [sessionId, steps, updateStep, pollSession]);

  const handleLoadHistory = useCallback((item: FtoHistoryItem) => {
    // 切换历史前：清除现有轮询，标记当前展示的会话
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    currentSessionRef.current = item.id;
    savedRef.current = false; // 重置保存标记，允许新一轮 saveToHistoryOnce

    // 运行中的任务：先从服务端获取实际状态再设置 UI
    if (item.status === "running") {
      setSessionId(item.id);
      setInputText(item.title);
      setInputCompetitors(item.keywords);
      setReport(null); setReportMarkdown("");
      setAssessments([]); setTopPatents([]); setElements(null);

      // 先设为加载中状态，避免硬编码 step1_running
      setPhase("steps2_4_running"); // 临时占位，pollSession 会立即修正
      setSteps({ 1:{status:"running",name:"技术理解"},2:{status:"pending",name:"专利检索"},3:{status:"pending",name:"风险评估"},4:{status:"pending",name:"报告生成"} });

      // 先拉取一次服务端实际状态，再启动轮询
      fetch(`/api/copilot/session/${item.id}`)
        .then((res) => {
          if (!res.ok) {
            // 会话已过期/不存在 → 标记为 completed
            const prev = safeReadJson<FtoHistoryItem[]>("fto-history", []);
            const updated = prev.map((h) => h.id === item.id ? { ...h, status: "completed" as const, stats: { ...h.stats, total: h.stats.total || 1 } } : h);
            saveToLocalStorage("fto-history", updated);
            setHistory(updated);
            setPhase("done");
            setReport(null);
            setReportMarkdown("⚠️ 该分析会话已过期，无法恢复。请新建分析。");
            setSteps({ 1:{status:"error",name:"技术理解"},2:{status:"error",name:"专利检索"},3:{status:"error",name:"风险评估"},4:{status:"error",name:"报告生成"} });
            return;
          }
          return res.json();
        })
        .then((s) => {
          if (!s?.steps) return;
          // 从服务端状态推导 phase
          const s1 = s.steps[1]; const s2 = s.steps[2]; const s3 = s.steps[3]; const s4 = s.steps[4];
          let actualPhase: Phase = "step1_running";
          if (s4?.status === "success") actualPhase = "done";
          else if (s3?.status === "success" || s3?.status === "running") actualPhase = "steps2_4_running";
          else if (s2?.status === "success" || s2?.status === "running") actualPhase = "steps2_4_running";
          else if (s1?.status === "success" && s2?.status === "pending") actualPhase = "hitl_wait";

          // 同步步骤状态
          const newSteps: Record<number, StepUI> = {} as Record<number, StepUI>;
          for (const num of [1,2,3,4]) {
            const sr = s.steps[num];
            if (!sr) continue;
            newSteps[num] = { status: sr.status, name: sr.name, stepRecord: sr };
          }
          setSteps(newSteps);
          if (actualPhase === "hitl_wait" && s1?.output?.elements) {
            setElements(s1.output.elements);
            elementsRef.current = s1.output.elements;
          }
          if (s2?.output?.topPatents) setTopPatents(s2.output.topPatents);
          if (s3?.output?.assessments) setAssessments(s3.output.assessments);
          if (s4?.output?.markdown) setReportMarkdown(s4.output.markdown);

          setPhase(actualPhase);

          // 如果会话已完成，直接显示报告
          if (actualPhase === "done") {
            // 更新历史状态为 completed（原为 running，已实际完成）
            const prev = safeReadJson<FtoHistoryItem[]>("fto-history", []);
            const updatedH = prev.map((h) => h.id === item.id ? { ...h, status: "completed" as const, stats: { ...h.stats, total: h.stats.total || 1 } } : h);
            saveToLocalStorage("fto-history", updatedH);
            setHistory(updatedH);
            try {
              const raw = s4?.output?.markdown ?? s.reportContent ?? "";
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object" && "riskLevel" in parsed) {
                setReport(parsed as FtoReport);
              }
            } catch { /* ignore */ }
            return; // 不需要轮询
          }
        })
        .catch(() => {});

      // 启动轮询
      pollingRef.current = setInterval(() => pollSession(item.id, "step1_running"), 2000);
      return;
    }

    // 已完成的任务：从 fto-history 加载报告
    setPhase("done"); setSessionId(item.id);
    currentSessionRef.current = item.id;
    savedRef.current = false; // 允许新一轮保存（防止服务端会话恢复后重复保存被拦截）
    setSteps({ 1:{status:"success",name:"技术理解"},2:{status:"success",name:"专利检索"},3:{status:"success",name:"风险评估"},4:{status:"success",name:"报告生成"} });
    if (item.reportJson) {
      try { const r = JSON.parse(item.reportJson) as FtoReport; setReport(r); setReportMarkdown(JSON.stringify(r,null,2)); }
      catch { setReport(null); setReportMarkdown(item.reportJson); }
    } else {
      setReport(null);
      setReportMarkdown("⚠️ 该报告数据未保存（可能是旧版本 FTO 生成）。请重新运行分析。");
    }
  }, [pollSession]);

  const handleNewAnalysis = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    currentSessionRef.current = null;
    setPhase("input"); setSessionId(null); savedRef.current = false;
    setReport(null); setReportMarkdown(""); setAssessments([]); setTopPatents([]); setElements(null);
    setInputText(""); setInputCompetitors([]);
    setSteps({ 1:{status:"pending",name:"技术理解"},2:{status:"pending",name:"专利检索"},3:{status:"pending",name:"风险评估"},4:{status:"pending",name:"报告生成"} });
    sessionStorage.removeItem(PERSIST_KEY);
  }, []);

  // 中断时重新运行 Step 1
  const handleRetryStep1 = useCallback(() => {
    if (inputText && inputCompetitors.length > 0) {
      handleSubmit(inputText, inputCompetitors);
    }
  }, [inputText, inputCompetitors, handleSubmit]);

  // 中断时重新运行 Steps 2-4
  const handleRetrySteps2to4 = useCallback(() => {
    if (elementsRef.current && sessionId) {
      handleHitlConfirm(elementsRef.current);
    } else if (inputText && inputCompetitors.length > 0) {
      // 从零重新开始
      handleSubmit(inputText, inputCompetitors);
    }
  }, [sessionId, inputText, inputCompetitors, handleSubmit, handleHitlConfirm]);

  // ── 重连横幅（后台任务持续运行中）──
  const ReconnectingBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Loader2 className="size-4 text-blue-600 mt-0.5 shrink-0 animate-spin" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">后台运行中</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
        >
          <RefreshCw className="size-3.5" /> 重新运行
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-full">
      <FtoHistorySidebar history={history} onSelectHistory={handleLoadHistory} onNewAnalysis={handleNewAnalysis} />

      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">⚡ FTO Copilot</h1>
          <p className="text-sm text-muted-foreground mt-1">研发前置专利风险排查 — 从 2 周到 2 分钟</p>
        </div>

        {phase === "input" && <WelcomeCard onSubmit={handleSubmit} />}

        {phase !== "input" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <HorizontalStepper steps={steps} onClickStep={(stepNum) => { const sr = steps[stepNum]?.stepRecord; if (sr) { setDetailStep(sr); setDetailOpen(true); } }} />

            {/* ── 后台运行中：step1_running 重连 ── */}
            {phase === "step1_running" && (
              <ReconnectingBanner
                message="任务正在后台执行「技术理解」阶段，轮询中..."
              />
            )}

            {/* ── 后台运行中：steps2_4_running 重连 ── */}
            {phase === "steps2_4_running" && (
              <>
                <ReconnectingBanner
                  message="任务正在后台执行「专利检索/风险评估/报告生成」阶段，轮询中..."
                />
                {/* 展示已收到的部分结果 */}
                {topPatents.length > 0 && (
                  <div className="space-y-2 opacity-60">
                    <p className="text-xs font-medium text-muted-foreground">已检索到 {topPatents.length} 件相关专利（部分结果）</p>
                    {topPatents.slice(0, 5).map((p, i) => (
                      <div
                        key={p.patentId || i}
                        className="flex items-center gap-3 text-sm rounded-lg border p-3 bg-white dark:bg-zinc-900 hover:border-blue-200 dark:hover:border-blue-800"
                      >
                        <span className="text-xs text-muted-foreground shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.pn} · {p.originalAssignee}</p></div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); openPreview(p); }} className="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">📄 预览</button>
                      </div>
                    ))}
                  </div>
                )}
                {assessments.length > 0 && (
                  <div className="space-y-3 opacity-60">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">风险评估结果（部分）</h3>
                    {assessments.map((a, i) => (
                      <RiskCard
                        key={`${a.patentId || `item`}-${i}`}
                        assessment={a} index={i}
                        onClick={() => openPreview({ patentId: a.patentId, pn: a.pn, apno: "", title: a.title, originalAssignee: "", currentAssignee: "", inventor: "", apdt: 0, pbdt: 0, authority: "" })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── hitl_wait（含恢复）── */}
            {phase === "hitl_wait" && elements && (
              <TechSummaryCard
                elements={elements}
                onConfirm={(modified) => {
                  setElements(modified); elementsRef.current = modified;
                  handleHitlConfirm(modified);
                }}
              />
            )}

            {/* Steps 2-4 实时结果 */}
            {phase === "steps2_4_running" && topPatents.length > 0 && steps[2].status === "success" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">检索到 {topPatents.length} 件相关专利</p>
                {topPatents.slice(0, 5).map((p, i) => (
                  <div
                    key={p.patentId || i}
                    className="flex items-center gap-3 text-sm rounded-lg border p-3 bg-white dark:bg-zinc-900 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/10"
                  >
                    <span className="text-xs text-muted-foreground shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.title}</p><p className="text-xs text-muted-foreground">{p.pn} · {p.originalAssignee}</p></div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openPreview(p); }} className="shrink-0 px-2 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">📄 预览</button>
                  </div>
                ))}
              </div>
            )}
            {phase === "steps2_4_running" && assessments.length > 0 && steps[3].status === "success" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">风险评估结果</h3>
                {assessments.map((a, i) => (
                  <RiskCard
                    key={`${a.patentId || `item`}-${i}`}
                    assessment={a} index={i}
                    onClick={() => openPreview({ patentId: a.patentId, pn: a.pn, apno: "", title: a.title, originalAssignee: "", currentAssignee: "", inventor: "", apdt: 0, pbdt: 0, authority: "" })}
                  />
                ))}
              </div>
            )}

            {/* done */}
            {phase === "done" && report && (
              <>
                <ResultVerdictCard report={report} sessionId={sessionId ?? "unknown"} onReset={handleNewAnalysis} />
                <NextActionsCard riskLevel={report.riskLevel} />
                <ReportPreview
                  title={report.title}
                  markdown={reportMarkdown || JSON.stringify(report)}
                  sessionId={sessionId ?? "unknown"}
                  onPatentClick={(p) => openPreview(p)}
                />
              </>
            )}
            {phase === "done" && !report && reportMarkdown && (
              <ReportPreview
                title="FTO 初审报告"
                markdown={reportMarkdown}
                sessionId={sessionId ?? "unknown"}
                onPatentClick={(p) => openPreview(p)}
              />
            )}
          </div>
        )}

        <StepDetailDrawer open={detailOpen} onClose={() => setDetailOpen(false)} stepRecord={detailStep} />
      </div>
    </div>
  );
}
