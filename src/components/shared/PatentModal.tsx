"use client";

/**
 * PatentModal — 全局专利预览弹窗（居中悬浮，双栏布局）
 *
 * 左栏（35%）：结构化信息 + AI 摘要 + 收藏
 * 右栏（65%）：PDF 全文（Live 调 P020 / Mock 读本地 demo-patents）
 *
 * 适用范围：所有出现专利名称的位置均触发出弹窗。
 *
 * 降级策略：Live 模式下若后端返回空数据（如 Mock 书签的虚拟 PN），
 * 自动回退使用 PatentSummary prop 中的缓存数据展示。
 */

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Star, Copy, Sparkles, ExternalLink, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logStore } from "@/lib/log-store";
import type { PatentSummary, PatentDetail, Claim } from "@/lib/types";

// ── 法律状态配置 ──
const LEGAL_CONFIG: Record<string, { label: string; cls: string }> = {
  active: { label: "有效", cls: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  expired: { label: "失效", cls: "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400" },
  pending: { label: "申请中", cls: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  unknown: { label: "未知", cls: "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400" },
};

function fmtDate(yyyymmdd: number): string {
  if (!yyyymmdd || yyyymmdd === 0) return "—";
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** 判断 detail 是否为空（Live 模式下 Mock 虚拟 PN 可能返回空数据） */
function isDetailEmpty(d: PatentDetail | null): boolean {
  if (!d) return true;
  return !d.title && !d.originalAssignee && d.apdt === 0;
}

/** 用 patent prop 构建降级 PatentDetail */
function buildFallbackDetail(patent: PatentSummary, reason: string): PatentDetail {
  return {
    patentId: patent.patentId,
    pn: patent.pn,
    apno: patent.apno,
    title: patent.title,
    originalAssignee: patent.originalAssignee,
    currentAssignee: patent.currentAssignee,
    inventor: patent.inventor,
    apdt: patent.apdt,
    pbdt: patent.pbdt,
    authority: patent.authority,
    abstract: `（${reason} · 展示缓存数据）`,
    claims: [],
    legalStatus: "unknown",
    ipcClasses: [],
    familySize: undefined,
  };
}

interface PatentModalProps {
  patent: PatentSummary | null;
  open: boolean;
  onClose: () => void;
}

export function PatentModal({ patent, open, onClose }: PatentModalProps) {
  const [detail, setDetail] = useState<PatentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [pnCollision, setPnCollision] = useState(false);

  // ── 检测当前数据模式 ──
  useEffect(() => {
    const cookie = document.cookie.split("; ").find((r) => r.startsWith("data-mode="));
    const cookieMode = cookie?.split("=")[1];
    setIsLiveMode(cookieMode === "live");
  }, [open]);

  // ── 加载详情 ──
  useEffect(() => {
    if (!patent || !open) return;
    setDetail(null); setError(""); setPdfUrl(null); setPdfError("");
    setAiSummary(null); setIsBookmarked(false); setIsFallback(false); setPnCollision(false);
    setLoading(true);
    setPdfLoading(true);

    // 检查收藏状态
    try {
      const bm: PatentSummary[] = JSON.parse(localStorage.getItem("bookmarked-patents") ?? "[]");
      setIsBookmarked(bm.some((p) => p.patentId === patent.patentId));
    } catch { /* ignore */ }

    // 并行加载详情 + PDF
    // 当 patentId 不是 UUID 格式时（如 "comp-Tesla-0"），改用 pn 查询
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patent.patentId);
    const detailParam = isUuid
      ? `patentId=${encodeURIComponent(patent.patentId)}`
      : `pn=${encodeURIComponent(patent.pn)}`;
    fetch(`/api/search/detail?${detailParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((d: { patent: PatentDetail; _endpoint?: string }) => {
        const endpoint = d._endpoint ?? "P012/P018/P041";
        const remoteDetail = d.patent;
        if (isDetailEmpty(remoteDetail)) {
          // Live 模式下返回空数据（Mock 虚拟 PN 在 Patsnap 中不存在或为其他专利）
          const fallback = buildFallbackDetail(patent, "Live 模式下该专利号无匹配数据");
          setDetail(fallback);
          setIsFallback(true);
          logStore.append({ type: "system", title: "专利预览降级", action: `${patent.pn} — Live 详情为空，使用缓存数据`, fullResponse: { endpoint } });
        } else if (patent.title && remoteDetail.title && patent.title !== remoteDetail.title) {
          // PN 碰撞：远程返回的专利与缓存标题不一致 → 使用缓存数据并警告
          const fallback = buildFallbackDetail(patent, "PN 碰撞 — Live 数据库中该专利号为其他专利");
          setDetail({ ...fallback, abstract: `${fallback.abstract}\n\n⚠️ Live 数据库实际专利：「${remoteDetail.title.slice(0, 80)}」(${remoteDetail.originalAssignee || "未知申请人"})` });
          setIsFallback(true);
          setPnCollision(true);
          setPdfUrl(null); // PN 碰撞时不展示 PDF（PDF 属于其他专利）
          setPdfError("该专利号对应 PDF 与缓存专利不一致，已屏蔽");
          logStore.append({ type: "system", title: "PN 碰撞警告", action: `${patent.pn} — 缓存:「${patent.title.slice(0, 40)}」≠ 实际:「${remoteDetail.title.slice(0, 40)}」`, fullResponse: { endpoint, remoteTitle: remoteDetail.title, remoteAssignee: remoteDetail.originalAssignee } });
        } else {
          setDetail(remoteDetail);
          setIsFallback(false);
          logStore.append({ type: "api", title: `${endpoint} 专利详情`, action: `${patent.pn} — 已加载`, fullResponse: { endpoint, title: remoteDetail.title?.slice(0, 60) } });
        }
      })
      .catch(() => {
        // 详情不可用时用 patent prop 构建降级展示
        const fallback = buildFallbackDetail(patent, "详情数据暂不可用");
        setDetail(fallback);
        setIsFallback(true);
        logStore.append({ type: "system", title: "专利预览降级", action: `${patent.pn} — API 不可达，使用缓存数据`, fullResponse: { endpoint: "P012/P018/P041", status: "API unreachable" } });
      })
      .finally(() => setLoading(false));

    fetch(`/api/patent/pdf?pn=${encodeURIComponent(patent.pn)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.signedUrl) {
          setPdfUrl(d.signedUrl);
          setPdfError("");
        } else if (d.mockPdfPath) {
          setPdfUrl(d.mockPdfPath);
          setPdfError("");
        } else {
          setPdfUrl(null);
          setPdfError(d.note ?? "");
        }
      })
      .catch((err) => {
        setPdfUrl(null);
        setPdfError(err?.message ?? "PDF 获取失败");
      })
      .finally(() => setPdfLoading(false));
  }, [patent, open]);

  // ── AI 摘要 ──
  const handleAiSummary = useCallback(async () => {
    if (!detail || aiSummaryLoading) return;
    setAiSummaryLoading(true);
    setAiSummary(null); // 清除旧摘要，避免显示过期内容
    try {
      const claimsText = detail.claims
        .filter((c) => c.isIndependent)
        .map((c) => c.text)
        .join("\n");

      // 如果连标题都没有，直接提示
      if (!detail.title && !detail.abstract && !claimsText) {
        setAiSummary("该专利在 Live 模式下无法获取完整信息，AI 摘要不可用。");
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s 超时
      const res = await fetch("/api/patent/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detail.title || "未知专利",
          abstract: detail.abstract ?? "",
          claimsText,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        setAiSummary(`AI 摘要服务异常 (${res.status})，请稍后重试。`);
        logStore.append({ type: "api", title: "AI 摘要 失败", action: `${detail.pn} — HTTP ${res.status}`, result: "服务异常" });
        return;
      }
      const data = await res.json();
      const text = (data.summary as string)?.trim();
      if (text) {
        logStore.append({ type: "api", title: "AI 摘要 完成", action: `${detail.pn} — ${detail.title?.slice(0, 40)}`, result: text.slice(0, 80) });
      } else {
        logStore.append({ type: "api", title: "AI 摘要 空响应", action: `${detail.pn} — 返回空内容`, result: "降级处理" });
      }
      setAiSummary(text || "AI 摘要生成失败，请稍后重试。");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setAiSummary("AI 摘要生成超时（>20s），请稍后重试。");
        logStore.append({ type: "api", title: "AI 摘要 超时", action: `${detail.pn} — >20s`, result: "请求超时" });
      } else {
        setAiSummary("AI 摘要请求失败（网络或服务异常），请稍后重试。");
        logStore.append({ type: "api", title: "AI 摘要 异常", action: `${detail.pn} — ${String(err)}`, result: "网络或服务异常" });
      }
    } finally {
      setAiSummaryLoading(false);
    }
  }, [detail, aiSummaryLoading]);

  // ── 收藏 ──
  const handleBookmark = useCallback(() => {
    if (!patent) return;
    try {
      const bm: PatentSummary[] = JSON.parse(localStorage.getItem("bookmarked-patents") ?? "[]");
      if (isBookmarked) {
        const next = bm.filter((p) => p.patentId !== patent.patentId);
        localStorage.setItem("bookmarked-patents", JSON.stringify(next));
        setIsBookmarked(false);
      } else {
        const next = [patent, ...bm].slice(0, 50);
        localStorage.setItem("bookmarked-patents", JSON.stringify(next));
        setIsBookmarked(true);
      }
      // 通知其他组件（首页、收藏页等）收藏列表已变更
      window.dispatchEvent(new CustomEvent("bookmarks-changed"));
    } catch { /* ignore */ }
  }, [patent, isBookmarked]);

  // ── 复制专利号 ──
  const handleCopyPn = useCallback(async () => {
    if (!patent?.pn) return;
    try {
      await navigator.clipboard.writeText(patent.pn);
    } catch { /* ignore */ }
  }, [patent]);

  if (!open || !patent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative w-[1100px] max-w-[95vw] h-[85vh] max-h-[92vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-muted-foreground truncate">{patent.pn}</span>
            {detail && (
              <Badge className={`text-[10px] ${LEGAL_CONFIG[detail.legalStatus]?.cls ?? LEGAL_CONFIG.unknown.cls}`}>
                {LEGAL_CONFIG[detail.legalStatus]?.label ?? detail.legalStatus}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{patent.authority}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={isBookmarked ? "default" : "outline"}
              className="h-8 gap-1 text-xs"
              onClick={handleBookmark}
            >
              <Star className={`size-3.5 ${isBookmarked ? "fill-current" : ""}`} />
              {isBookmarked ? "已收藏" : "收藏"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleCopyPn}>
              <Copy className="size-3" /> 复制
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 双栏内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左栏：结构化信息 — 有权利要求时 35%，无权利要求时固定窄栏 */}
          <div className={`min-w-0 overflow-y-auto p-4 space-y-4 border-r ${detail && detail.claims.length > 0 ? "w-[35%]" : "w-[280px] shrink-0"}`}>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 text-center py-8">{error}</p>
            )}

            {!loading && !error && detail && (
              <>
                {/* 降级提示 */}
                {isFallback && (
                  <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>该专利来自 Mock 缓存，Live 模式下真实数据不可用。以下展示缓存信息。</span>
                  </div>
                )}

                {/* PN 碰撞警告：远程返回的标题与缓存不一致 */}
                {!isFallback && detail.title && patent.title && detail.title !== patent.title && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                      注意：该专利号在 Live 数据库中对应的是另一件专利（"{detail.title.slice(0, 50)}"），
                      与收藏的 Mock 数据不一致。请以数据库实际内容为准。
                    </span>
                  </div>
                )}

                {/* 标题 */}
                <h3 className="text-sm font-semibold leading-snug">{detail.title}</h3>

                {/* 元信息 */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <div><span className="font-medium">申请人：</span>{detail.originalAssignee}</div>
                  <div><span className="font-medium">发明人：</span>{(detail.inventor ?? "").split("|").slice(0, 2).join(" / ")}</div>
                  <div><span className="font-medium">申请日：</span>{fmtDate(detail.apdt)}</div>
                  <div><span className="font-medium">公开日：</span>{fmtDate(detail.pbdt)}</div>
                </div>

                {/* IPC */}
                {detail.ipcClasses && detail.ipcClasses.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold mb-1">IPC 分类号</h4>
                    <div className="flex flex-wrap gap-1">
                      {detail.ipcClasses.map((ipc) => (
                        <Badge key={ipc} variant="outline" className="text-[10px] font-mono">
                          {ipc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 摘要 */}
                {detail.abstract && (
                  <div>
                    <h4 className="text-[11px] font-semibold mb-1">摘要</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{detail.abstract}</p>
                  </div>
                )}

                {/* AI 摘要 */}
                <div>
                  <button
                    onClick={handleAiSummary}
                    disabled={aiSummaryLoading}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    <Sparkles className="size-3" />
                    {aiSummaryLoading ? "生成中…" : "✨ AI 摘要"}
                  </button>
                  {aiSummary && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                      {aiSummary}
                    </p>
                  )}
                </div>

                {/* 权利要求 */}
                {detail.claims.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold mb-2">
                      权利要求（{detail.claims.length} 条）
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {detail.claims.map((claim: Claim, idx: number) => (
                        <details
                          key={`${claim.number}-${idx}`}
                          className="border rounded-lg p-2.5"
                          open={claim.isIndependent}
                        >
                          <summary className="text-[11px] font-medium cursor-pointer flex items-center gap-1.5">
                            {claim.isIndependent && (
                              <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">独立</Badge>
                            )}
                            Claim {claim.number}
                            {claim.parentClaim != null && (
                              <span className="text-muted-foreground">←{claim.parentClaim}</span>
                            )}
                          </summary>
                          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                            {claim.text}
                          </p>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {/* 同族 */}
                {detail.familySize != null && detail.familySize > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    同族专利：{detail.familySize} 件
                  </p>
                )}
              </>
            )}
          </div>

          {/* 右栏：PDF — 无权利要求时自动扩展填满剩余空间 */}
          <div className={`min-w-0 flex flex-col bg-zinc-50 dark:bg-zinc-950 ${detail && detail.claims.length > 0 ? "w-[65%]" : "flex-1"}`}>
            {pdfLoading && (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!pdfLoading && pdfUrl && (
              <iframe
                src={pdfUrl}
                className="flex-1 w-full border-0"
                title={`PDF: ${patent.pn}`}
              />
            )}

            {!pdfLoading && !pdfUrl && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <ExternalLink className="size-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">PDF 全文不可用</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {pdfError
                    ? pdfError
                    : isLiveMode
                      ? "该专利 PDF 数据不可用（可能是虚拟专利号或 PDF 未收录）"
                      : "演示模式 · 切换 Live 可查看完整 PDF"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
