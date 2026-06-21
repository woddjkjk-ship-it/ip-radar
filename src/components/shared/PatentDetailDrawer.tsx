"use client";

/**
 * PatentDetailDrawer — 专利详情右抽屉
 *
 * 检索/监控页面复用：点击专利卡片 → 调 /api/search/detail → 渲染摘要/权利要求/法律状态。
 * 操作按钮：「加入 FTO 分析」「创建监控」
 */

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Shield } from "lucide-react";
import type { PatentSummary, PatentDetail } from "@/lib/types";

interface PatentDetailDrawerProps {
  patent: PatentSummary | null;
  open: boolean;
  onClose: () => void;
}

/** YYYYMMDD → YYYY-MM-DD */
function formatDate(yyyymmdd: number): string {
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

const LEGAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: "有效", className: "bg-green-100 text-green-700 border-green-300" },
  expired: { label: "失效", className: "bg-zinc-100 text-zinc-500 border-zinc-300" },
  pending: { label: "申请中", className: "bg-blue-100 text-blue-700 border-blue-300" },
  unknown: { label: "未知", className: "bg-zinc-100 text-zinc-500 border-zinc-300" },
};

export function PatentDetailDrawer({ patent, open, onClose }: PatentDetailDrawerProps) {
  const [detail, setDetail] = useState<PatentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patent || !open) return;
    setDetail(null);
    setError("");
    setLoading(true);
    fetch(`/api/search/detail?patentId=${encodeURIComponent(patent.patentId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { patent: PatentDetail }) => setDetail(d.patent))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [patent, open]);

  const handleAddToFto = () => {
    if (!patent) return;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("fto-pending-patents") ?? "[]");
      if (!prev.includes(patent.patentId)) {
        prev.unshift(patent.patentId);
        localStorage.setItem("fto-pending-patents", JSON.stringify(prev.slice(0, 20)));
      }
    } catch { /* ignore */ }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {patent ? `${patent.pn}` : "专利详情"}
          </SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 py-8 text-center">{error}</div>
        )}

        {!loading && !error && detail && (
          <div className="mt-4 space-y-5">
            {/* 标题 + 法律状态 */}
            <div>
              <h3 className="text-sm font-semibold leading-snug">{detail.title}</h3>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  className={`text-xs ${
                    LEGAL_STATUS_CONFIG[detail.legalStatus]?.className ??
                    LEGAL_STATUS_CONFIG.unknown.className
                  }`}
                >
                  {LEGAL_STATUS_CONFIG[detail.legalStatus]?.label ?? detail.legalStatus}
                </Badge>
                {detail.authority && (
                  <span className="text-xs text-muted-foreground">{detail.authority}</span>
                )}
              </div>
            </div>

            {/* 元信息 */}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">申请人：</span>
                {detail.originalAssignee}
              </div>
              <div>
                <span className="font-medium">申请日：</span>
                {formatDate(detail.apdt)}
              </div>
              <div>
                <span className="font-medium">公开日：</span>
                {formatDate(detail.pbdt)}
              </div>
              <div>
                <span className="font-medium">发明人：</span>
                {detail.inventor?.split("|").slice(0, 2).join(" / ")}
              </div>
            </div>

            {/* IPC 分类 */}
            {detail.ipcClasses && detail.ipcClasses.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1.5">IPC 分类号</h4>
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
                <h4 className="text-xs font-semibold mb-1.5">摘要</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {detail.abstract}
                </p>
              </div>
            )}

            {/* 权利要求 */}
            {detail.claims.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-2">
                  权利要求（{detail.claims.length} 条）
                </h4>
                <div className="space-y-3">
                  {detail.claims.map((claim, idx) => (
                    <details
                      key={`${claim.number}-${idx}`}
                      className="border rounded-lg p-3"
                    >
                      <summary className="text-xs font-medium cursor-pointer flex items-center gap-2">
                        {claim.isIndependent && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                            独立
                          </Badge>
                        )}
                        Claim {claim.number}
                        {claim.parentClaim != null && (
                          <span className="text-muted-foreground">
                            （从属 Claim {claim.parentClaim}）
                          </span>
                        )}
                      </summary>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {claim.text}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-3 border-t">
              <Button size="sm" variant="outline" onClick={handleAddToFto}>
                <Shield className="size-3.5 mr-1" />
                加入 FTO 分析
              </Button>
              <Button size="sm" variant="outline">
                <FileText className="size-3.5 mr-1" />
                创建监控
              </Button>
            </div>

            {/* 专利族大小 */}
            {detail.familySize != null && detail.familySize > 0 && (
              <p className="text-xs text-muted-foreground">
                同族专利：{detail.familySize} 件
              </p>
            )}
          </div>
        )}

        {!loading && !error && !detail && (
          <p className="text-sm text-muted-foreground py-8 text-center">无数据</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
