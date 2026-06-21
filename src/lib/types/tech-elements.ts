/**
 * 技术要素类型 — FTO Copilot Step 1（理解）的输出
 *
 * LLM 从用户输入的技术方案文本中提取结构化要素，
 * 用于驱动 Step 2（检索）。
 */

import { z } from "zod";

/** LLM 从技术方案中提取的结构化要素 */
export interface TechElements {
  /** 解决的技术问题 */
  problem: string;
  /** 技术方案描述 */
  solution: string;
  /** 创新点/新颖性 */
  novelty: string;
  /** 技术关键词列表 */
  keywords: string[];
  /** LLM 推测的 IPC 分类号 */
  guessedIpc: string[];
  /** 竞品池企业（从配置中继承，用户可修改） */
  competitors: string[];
  /** 构造给语义检索用的长文本（problem + solution + novelty 拼接） */
  problemSolutionText: string;
}

// ===== Zod Schema =====

export const TechElementsSchema = z.object({
  problem: z.string(),
  solution: z.string(),
  novelty: z.string(),
  keywords: z.array(z.string()),
  guessedIpc: z.array(z.string()),
  competitors: z.array(z.string()),
  problemSolutionText: z.string(),
});

/** Step 1 的完整输出（含用户修改前后的快照） */
export interface UnderstandStepOutput {
  /** LLM 原始提取 */
  extracted: TechElements;
  /** 用户修改后（HITL），初始等于 extracted */
  confirmed: TechElements;
  /** 用户是否修改过 */
  modified: boolean;
}
