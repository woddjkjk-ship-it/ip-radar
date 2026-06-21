"use client";

/**
 * ElementsEditor — HITL 技术要素编辑器
 *
 * Step 1 完成后展示 LLM 提取的技术要素，用户可修改后确认。
 * 支持：修改问题/方案/创新点文本、增删关键词标签、调整 IPC 分类号。
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ChevronRight } from "lucide-react";
import type { TechElements } from "@/lib/types";

interface ElementsEditorProps {
  elements: TechElements;
  onConfirm: (modified: TechElements) => void;
  onRetry: () => void;
  disabled?: boolean;
}

export function ElementsEditor({
  elements: initial,
  onConfirm,
  onRetry,
  disabled,
}: ElementsEditorProps) {
  const [problem, setProblem] = useState(initial.problem);
  const [solution, setSolution] = useState(initial.solution);
  const [novelty, setNovelty] = useState(initial.novelty);
  const [keywords, setKeywords] = useState<string[]>(initial.keywords);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    setProblem(initial.problem);
    setSolution(initial.solution);
    setNovelty(initial.novelty);
    setKeywords(initial.keywords);
  }, [initial]);

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleConfirm = () => {
    const modified: TechElements = {
      ...initial,
      problem,
      solution,
      novelty,
      keywords,
      problemSolutionText: `${problem}\n${solution}\n${novelty}`,
    };
    onConfirm(modified);
  };

  const modified =
    problem !== initial.problem ||
    solution !== initial.solution ||
    novelty !== initial.novelty ||
    JSON.stringify(keywords) !== JSON.stringify(initial.keywords);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">确认 / 微调技术要素</h3>
        <p className="text-sm text-muted-foreground mt-1">
          AI 已提取以下要素，你可以修改后进入专利检索
        </p>
      </div>

      {/* 技术问题 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">技术问题</label>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
      </div>

      {/* 技术方案 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">技术方案</label>
        <textarea
          value={solution}
          onChange={(e) => setSolution(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
      </div>

      {/* 创新点 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">创新点</label>
        <textarea
          value={novelty}
          onChange={(e) => setNovelty(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input bg-background p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
      </div>

      {/* 关键词 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">关键词</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywords.map((kw) => (
            <Badge
              key={kw}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {kw}
              {!disabled && (
                <button onClick={() => removeKeyword(kw)} type="button">
                  <X className="size-3" />
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
              className="flex-1 rounded-lg border border-input bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" variant="outline" onClick={addKeyword} type="button">
              <Plus className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* IPC 分类号（只读） */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">推测 IPC 分类号</label>
        <div className="flex flex-wrap gap-1.5">
          {initial.guessedIpc.map((ipc) => (
            <Badge key={ipc} variant="outline" className="text-xs font-mono">
              {ipc}
            </Badge>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleConfirm}
          disabled={disabled}
          className="flex-1"
        >
          确认并开始检索
          <ChevronRight className="size-4 ml-1" />
        </Button>
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={disabled}
        >
          重新提取
        </Button>
      </div>
      {modified && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          已修改要素，点击确认后将使用修改后的要素进行检索
        </p>
      )}
    </div>
  );
}
