/**
 * Mock LLM 响应 — Agent 层在 LLM 不可用时（无 API key / Mock 模式）的兜底
 *
 * 为什么放在 agent 层而非 llm 层：
 * - LLM 层只负责调用外部 API，不感知业务语义
 * - Mock 响应与具体业务步骤强相关，属于 Agent 编排的知识
 * - 保持 LLM 层的 MockProvider-style 抽象更干净（留给未来扩展）
 */

import type { TechElements } from "@/lib/types";
import type { RiskAssessment } from "@/lib/types";

/** Step 1: 技术要素提取 Mock 响应 */
export function mockUnderstand(
  text: string,
  competitors: string[],
): TechElements {
  return {
    problem: "现有多模态融合方法中时空关联信息丢失、时间戳对齐误差导致融合不稳定、以及 Transformer 架构在车载端侧推理延迟过高的问题",
    solution: "通过跨模态空间注意力（LiDAR voxel + Camera patch + Radar position encoding）融合多传感器数据，利用时间注意力对连续帧进行轨迹建模，通过知识蒸馏（Swin-L → EfficientDet）将推理延迟从 120ms 压缩至 28ms",
    novelty: "三模态交叉注意力机制实现特征级融合、时间窗口 temporal self-attention 捕捉动态目标运动轨迹、知识蒸馏实现车载实时推理",
    keywords: [
      "多模态融合",
      "时空注意力",
      "激光雷达",
      "知识蒸馏",
      "自动驾驶",
      "Transformer",
      "3D目标检测",
      "跨模态注意力",
    ],
    guessedIpc: ["G06V20/58", "G06V10/80", "G01S17/86", "G06N3/045", "G06N3/096"],
    competitors: competitors.slice(0, 5),
    problemSolutionText: `${text.slice(0, 500)}`,
  };
}

/** Step 2: 去重融合 Mock 响应 */
export function mockDedupMerge(): {
  topPatents: { patentId: string; pn: string; apno: string; title: string; originalAssignee: string; currentAssignee: string; inventor: string; apdt: number; pbdt: number; authority: string; relevancyReason: string }[];
  dedupNote: string;
} {
  return {
    topPatents: [
      {
        patentId: "550e8400-e29b-41d4-a716-446655440003",
        pn: "US20240234567B2",
        apno: "US18/234567",
        title: "Multi-modal sensor fusion using cross-attention and knowledge distillation for autonomous vehicles",
        originalAssignee: "Waymo LLC",
        currentAssignee: "Waymo LLC",
        inventor: "HIGASHITANI, MITSUHARU|IKEMOTO, NORIAKI|HASE, TOMOMI",
        apdt: 20230815,
        pbdt: 20240718,
        authority: "US",
        relevancyReason: "独立权利要求直接覆盖三模态交叉注意力融合 + 知识蒸馏，与技术方案核心步骤高度重叠",
      },
      {
        patentId: "550e8400-e29b-41d4-a716-446655440002",
        pn: "CN116123456A",
        apno: "CN202310123456.7",
        title: "一种基于时空注意力的自动驾驶环境感知方法与装置",
        originalAssignee: "华为技术有限公司",
        currentAssignee: "华为技术有限公司",
        inventor: "王明|李华|张强",
        apdt: 20230215,
        pbdt: 20230516,
        authority: "CN",
        relevancyReason: "覆盖时空注意力机制 + 知识蒸馏，中国专利对国内市场有直接威胁",
      },
      {
        patentId: "550e8400-e29b-41d4-a716-446655440001",
        pn: "US20230123456A1",
        apno: "US17/945678",
        title: "跨模态注意力机制的多传感器融合感知方法及自动驾驶系统",
        originalAssignee: "Tesla, Inc.",
        currentAssignee: "Tesla, Inc.",
        inventor: "ZHANG, WEI|LI, XIAO",
        apdt: 20220930,
        pbdt: 20230420,
        authority: "US",
        relevancyReason: "覆盖跨模态注意力融合，涉及时间自注意力机制，与方案 S3/S4 步骤相关",
      },
      {
        patentId: "550e8400-e29b-41d4-a716-446655440004",
        pn: "EP4567890A1",
        apno: "EP2024056789",
        title: "Verfahren und System zur Sensordatenfusion für automatisiertes Fahren mittels Aufmerksamkeitsmechanismen",
        originalAssignee: "Robert Bosch GmbH",
        currentAssignee: "Robert Bosch GmbH",
        inventor: "MÜLLER, THOMAS|SCHMIDT, ANNA",
        apdt: 20240301,
        pbdt: 20241120,
        authority: "EP",
        relevancyReason: "覆盖 Transformer 注意力机制的多传感器融合，但未涉及知识蒸馏",
      },
    ],
    dedupNote: "从四路搜索结果中去除 2 条同族重复，最终保留 4 条高相关专利",
  };
}

/** Step 3: 风险评估 Mock 响应 */
export function mockAssess(): RiskAssessment[] {
  return [
    {
      patentId: "550e8400-e29b-41d4-a716-446655440003",
      pn: "US20240234567B2",
      title: "Multi-modal sensor fusion using cross-attention and knowledge distillation for autonomous vehicles",
      riskLevel: "high",
      matchedClaims: [1, 5],
      claimRef: 1,
      claimExcerpt: "A method comprising: voxelizing LiDAR point clouds, embedding camera image patches, encoding radar positions, fusing via cross-modal attention, applying temporal self-attention across frames, and detecting 3D objects from fused features.",
      overlapPoint: "三模态交叉注意力机制实现特征级融合 + 时间窗口 temporal self-attention",
      analysis: "独立权利要求 1 覆盖'点云体素化 + 图像分块嵌入 + 雷达位置编码 → 跨模态注意力融合 → 时间自注意力 → 3D 检测'这一完整流程，与方案 S2-S4 步骤高度重叠。权利要求 5 进一步覆盖知识蒸馏压缩至车载平台，直接命中方案 S5。",
      avoidanceAdvice: "（1）将跨模态注意力改为'模态特定编码器 + 门控融合'方案，避免使用 cross-attention 术语；（2）时间建模改用 Kalman 滤波 + LSTM 替代 temporal self-attention；（3）知识蒸馏 Teacher 从 Swin-L 改为 ConvNeXt-Base，Student 采用 YOLOv8 轻量结构，形成可专利化的差异化路径",
    },
    {
      patentId: "550e8400-e29b-41d4-a716-446655440002",
      pn: "CN116123456A",
      title: "一种基于时空注意力的自动驾驶环境感知方法与装置",
      riskLevel: "medium",
      matchedClaims: [1, 2],
      analysis: "独立权利要求 1 覆盖时空注意力融合的基本流程，但未限定具体的 voxel/patch/position-encoding 输入形式，保护范围较宽但技术细节不如本方案深入。权利要求 2 的知识蒸馏特征与中国市场相关。",
      avoidanceAdvice: "（1）在专利申请中强调三模态具体编码方式的差异化；（2）监控该专利的审查状态，若权利要求被缩小，风险可能降为 Low",
    },
    {
      patentId: "550e8400-e29b-41d4-a716-446655440001",
      pn: "US20230123456A1",
      title: "跨模态注意力机制的多传感器融合感知方法及自动驾驶系统",
      riskLevel: "medium",
      matchedClaims: [1],
      analysis: "覆盖跨模态注意力融合的基本框架，但未涉及时间注意力轨迹建模和知识蒸馏，技术方案的差异化程度较高。作为 Tesla 专利，竞品威胁度较高。",
      avoidanceAdvice: "（1）在技术文档中明确区分'空间注意力 + 时间注意力'的两阶段架构，强调 Tesla 专利仅覆盖空间融合；（2）将知识蒸馏作为核心区别技术特征写入新专利申请",
    },
    {
      patentId: "550e8400-e29b-41d4-a716-446655440004",
      pn: "EP4567890A1",
      title: "Verfahren und System zur Sensordatenfusion für automatisiertes Fahren mittels Aufmerksamkeitsmechanismen",
      riskLevel: "low",
      matchedClaims: [],
      analysis: "覆盖一般性的注意力机制传感器融合，但未涉及时间注意力建模、知识蒸馏、以及具体的输入编码方式，与本方案的技术细节重叠度低。",
      avoidanceAdvice: "",
    },
  ];
}

/** Step 4: 报告生成 Mock 响应 */
export function mockReport(): string {
  return `# FTO 初审报告

## 基本信息

- **技术方案**: 基于时空注意力机制的多模态自动驾驶感知融合方法
- **分析日期**: ${new Date().toISOString().slice(0, 10)}
- **检索范围**: US / CN / EP
- **竞品池**: Tesla / Waymo / Mobileye / 华为车BU / 小鹏 / 地平线 / Nvidia

## 技术要素概述

- **技术问题**: 现有多模态融合方法中时空关联信息丢失、时间戳对齐误差导致融合不稳定、以及 Transformer 架构在车载端侧推理延迟过高
- **技术方案**: 通过跨模态空间注意力（LiDAR voxel + Camera patch + Radar position encoding）融合多传感器数据，利用时间注意力对连续帧进行轨迹建模，通过知识蒸馏（Swin-L → EfficientDet）将推理延迟从 120ms 压缩至 28ms
- **创新点**: 三模态交叉注意力机制实现特征级融合、时间窗口 temporal self-attention 捕捉动态目标运动轨迹、知识蒸馏实现车载实时推理

## 风险评估

### 🔴 高风险（1 项）

| 专利号 | 标题 | 风险等级 | 命中权利要求 |
|--------|------|----------|--------------|
| US20240234567B2 | Multi-modal sensor fusion using cross-attention and knowledge distillation | 🔴 High | Claim 1, 5 |

**分析**: 独立权利要求 1 覆盖'点云体素化 + 图像分块嵌入 + 雷达位置编码 → 跨模态注意力融合 → 时间自注意力 → 3D 检测'完整流程。权利要求 5 覆盖知识蒸馏压缩至车载平台。

**规避建议**:
1. 将跨模态注意力改为'模态特定编码器 + 门控融合'方案
2. 时间建模改用 Kalman 滤波 + LSTM 替代 temporal self-attention
3. 知识蒸馏 Teacher 从 Swin-L 改为 ConvNeXt-Base，Student 采用 YOLOv8 轻量结构

### 🟡 中风险（2 项）

| 专利号 | 标题 | 风险等级 |
|--------|------|----------|
| CN116123456A | 基于时空注意力的自动驾驶环境感知方法 | 🟡 Medium |
| US20230123456A1 | 跨模态注意力多传感器融合感知方法 | 🟡 Medium |

### 🟢 低风险（1 项）

| 专利号 | 标题 | 风险等级 |
|--------|------|----------|
| EP4567890A1 | Sensordatenfusion für automatisiertes Fahren | 🟢 Low |

## 结论与建议

1. **高风险专利 US20240234567B2**: 建议进行详细的 claim chart 分析，若确认侵权风险，优先进行规避设计或与 Waymo 洽谈许可
2. **中风险专利**: 监控审查状态，在自有专利中强化区别技术特征
3. **总体评估**: 技术方案存在 1 项高风险，建议在正式研发前完成规避设计并申请新专利保护

---
*本报告由 IP Radar FTO Copilot 自动生成，仅供参考，不构成法律意见。*
`;
}
