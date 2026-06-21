"use client";

/**
 * TechSummaryCard — 技术要素紧凑确认卡
 *
 * Step 1 完成后展示，默认折叠两行，可展开查看/编辑完整要素。
 * 替代原来半途弹出的 ElementsEditor 大块内容。
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Check, Pencil } from "lucide-react";
import type { TechElements } from "@/lib/types";

interface TechSummaryCardProps {
  elements: TechElements;
  onConfirm: (modified: TechElements) => void;
  disabled?: boolean;
}

export function TechSummaryCard({ elements: initial, onConfirm, disabled }: TechSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [problem, setProblem] = useState(initial.problem);
  const [solution, setSolution] = useState(initial.solution);
  const [novelty, setNovelty] = useState(initial.novelty);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [newKeyword, setNewKeyword] = useState("");

  const modified =
    problem !== initial.problem ||
    solution !== initial.solution ||
    novelty !== initial.novelty ||
    JSON.stringify(keywords) !== JSON.stringify(initial.keywords);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setNewKeyword("");
    }
  };

  const handleConfirm = () => {
    onConfirm({
      ...initial,
      problem,
      solution,
      novelty,
      keywords,
      problemSolutionText: `${problem}\n${solution}\n${novelty}`,
    });
  };

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
      {/* 收起状态 */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Check className="size-4 text-green-500" />
          <span className="text-sm font-semibold">已理解你的方案</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">关键词：</span>
          {keywords.slice(0, 6).map((kw) => (
            <Badge key={kw} variant="secondary" className="text-xs">
              {kw}
            </Badge>
          ))}
          {keywords.length > 6 && (
            <span className="text-xs text-muted-foreground">+{keywords.length - 6}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          涉及领域：{initial.guessedIpc.join(" · ")}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" /> 收起
              </>
            ) : (
              <>
                <ChevronDown className="size-3" /> 展开编辑
              </>
            )}
          </button>
          <Button size="sm" onClick={handleConfirm} disabled={disabled} className="ml-auto">
            <Check className="size-3.5 mr-1" />
            确认，开始检索
          </Button>
        </div>
      </div>

      {/* 展开编辑区 */}
      {expanded && (
        <div className="border-t p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">技术问题</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">技术方案</label>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">创新点</label>
            <textarea
              value={novelty}
              onChange={(e) => setNovelty(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">关键词</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="flex items-center gap-1 pr-1">
                  {kw}
                  {!disabled && (
                    <button
                      onClick={() => setKeywords(keywords.filter((k) => k !== kw))}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            {!disabled && (
              <div className="flex gap-2">
                <input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                  placeholder="添加关键词..."
                  className="flex-1 rounded-lg border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" variant="outline" onClick={addKeyword}>
                  <Pencil className="size-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">推测 IPC 分类号</label>
            <div className="flex flex-wrap gap-1">
              {initial.guessedIpc.map((ipc) => (
                <Badge key={ipc} variant="outline" className="text-[10px] font-mono">
                  {ipc}
                </Badge>
              ))}
            </div>
          </div>
          {modified && (
            <p className="text-xs text-amber-600">已修改要素，点击确认后生效</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirm} disabled={disabled} className="flex-1">
              <Check className="size-3.5 mr-1" />
              确认并使用修改
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
              折叠
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
