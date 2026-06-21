"use client";

/**
 * InputPanel — FTO Copilot 输入面板
 *
 * 用户在此输入技术方案文本 + 可选架构图上传 + 选择竞品池。
 * 点击"开始分析"触发 FTO 流水线。
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, X } from "lucide-react";

/** 默认竞品池 */
const DEFAULT_COMPETITORS = [
  "Tesla",
  "Waymo",
  "Mobileye",
  "华为车BU",
  "小鹏",
  "地平线",
  "Nvidia",
];

/** 演示场景文本 */
const DEMO_SCENARIO = `技术领域
本发明涉及自动驾驶感知技术，具体是一种基于时空注意力机制的多模态传感器融合方法及系统。

背景技术
现有自动驾驶感知系统多采用激光雷达、摄像头、毫米波雷达独立处理后做目标级融合（late fusion）。
这种方式存在以下问题：
1. 各传感器独立处理时丢失了跨模态的时空关联信息
2. 不同传感器的时间戳对齐误差导致融合结果不稳定
3. Transformer 架构在 CV 领域已展现强大的全局注意力建模能力，但在车载实时推理场景下计算开销过大

技术方案
S1、获取激光雷达点云、摄像头图像、毫米波雷达目标列表三种模态的原始数据
S2、对点云做 voxelization（体素化），对图像做 patch embedding，对雷达目标做位置编码
S3、构建跨模态时空注意力模块：空间注意力分支（cross-attention）+ 时间注意力分支（temporal self-attention）
S4、将时空融合特征输入检测头（3D 目标检测 + 运动预测）
S5、采用知识蒸馏策略，用大模型教师网络训练轻量学生网络，将推理延迟压缩至 30ms 以内

有益效果
通过跨模态空间注意力融合互补特征，夜间/雨雾天比单一传感器提升 15% mAP；
时间注意力轨迹建模使动态目标位置预测误差降低 23%；
知识蒸馏将推理延迟从 120ms 压缩至 28ms，满足车规实时性要求。`;

interface InputPanelProps {
  onSubmit: (text: string, competitors: string[], imageRef?: string) => void;
  disabled?: boolean;
}

export function InputPanel({ onSubmit, disabled }: InputPanelProps) {
  const [text, setText] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([
    "Tesla",
    "Waymo",
    "Mobileye",
    "华为车BU",
    "Nvidia",
  ]);
  const [imageRef, setImageRef] = useState<string | undefined>(undefined);

  const toggleCompetitor = (c: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const handleSubmit = () => {
    if (text.trim().length < 10) return;
    onSubmit(text.trim(), selectedCompetitors, imageRef);
  };

  const fillDemo = () => {
    setText(DEMO_SCENARIO);
  };

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-semibold">描述你的技术方案</h2>
        <p className="text-sm text-muted-foreground mt-1">
          粘贴技术交底书或方案描述，AI 会自动找到潜在专利风险
        </p>
      </div>

      {/* 文本输入 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">技术方案</label>
          <button
            onClick={fillDemo}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            type="button"
          >
            填入演示场景
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="请描述你的技术方案，包括：技术领域、背景技术、技术问题、技术方案、有益效果..."
          rows={12}
          className="w-full rounded-lg border border-input bg-background p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={disabled}
        />
      </div>

      {/* 竞品池选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">重点关注哪些竞品的专利？（可选）</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_COMPETITORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCompetitor(c)}
              disabled={disabled}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCompetitors.includes(c)
                  ? "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700"
                  : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 架构图上传（可选） */}
      <div className="space-y-2">
        <label className="text-sm font-medium">架构图上传（可选）</label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2">
            <Upload className="size-4" />
            上传图片
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // 简单标记，实际项目中应上传到 CDN
                  setImageRef(file.name);
                }
              }}
            />
          </label>
          {imageRef && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              {imageRef}
              <button onClick={() => setImageRef(undefined)} type="button">
                <X className="size-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* 提交按钮 */}
      <Button
        onClick={handleSubmit}
        disabled={disabled || text.trim().length < 10}
        className="w-full"
        size="lg"
      >
        <Search className="size-4 mr-2" />
        开始风险排查
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        ⏱ 通常 1–2 分钟完成
      </p>
    </div>
  );
}
