/**
 * AI 助手演示案例 Fixture
 *
 * 每个 Skill 提供 3 个演示 chip，chipLabel 用于按钮展示，demoText 用于填充输入框。
 * findDemoAction() 在 demoText 精确匹配时返回预设 SkillAction，短路 LLM 调用。
 * 规格：DESIGN.md Section 6.13
 */

import type { SkillAction } from "@/lib/tools/types";

export interface DemoCase {
  /** chip 按钮上展示的简短文本 */
  chipLabel: string;
  /** 点击 chip 时填入 textarea 的完整文本（与 findDemoAction 匹配用） */
  demoText: string;
  /** 说明用途 */
  description: string;
  /** 预设的 UI 动作 */
  action: SkillAction;
}

export const SKILL_DEMO_CASES: Record<string, DemoCase[]> = {
  // ── 专利检索（3 个演示）──
  smart_patent_search: [
    {
      chipLabel: "特斯拉纯视觉感知专利",
      demoText: "特斯拉纯视觉感知最新专利",
      description: "切到「企业检索」Tab，填入 Tesla，自动触发搜索",
      action: {
        type: "fill_and_search",
        tab: "company",
        params: { company: "Tesla", keyword: "纯视觉感知" },
        autoSubmit: true,
      },
    },
    {
      chipLabel: "多传感器融合技术布局",
      demoText: "多传感器融合技术布局",
      description: "语义检索模式，填入技术描述，自动触发",
      action: {
        type: "fill_and_search",
        tab: "semantic",
        params: { text: "多传感器融合技术布局" },
        autoSubmit: true,
      },
    },
    {
      chipLabel: "CN116994312A 是什么",
      demoText: "CN116994312A 是什么专利",
      description: "切到「专利号」Tab，填入专利号，自动触发查询",
      action: {
        type: "fill_and_search",
        tab: "pn",
        params: { pns: "CN116994312A" },
        autoSubmit: true,
      },
    },
  ],

  // ── 技术调研（3 个演示）──
  tech_research_planner: [
    {
      chipLabel: "端到端自动驾驶近几年趋势",
      demoText: "端到端自动驾驶近几年趋势",
      description: "填入主题词、年份 2020-2025、受理局 CN+US，自动触发分析",
      action: {
        type: "fill_and_search",
        params: {
          query: "端到端自动驾驶",
          from: 2020,
          to: 2025,
          authorities: ["CN", "US"],
        },
        autoSubmit: true,
      },
    },
    {
      chipLabel: "激光雷达赛道谁最厉害",
      demoText: "激光雷达赛道谁最厉害",
      description: "填入主题词、年份 2019-2025、三大受理局，触发分析",
      action: {
        type: "fill_and_search",
        params: {
          query: "激光雷达 LiDAR 自动驾驶感知",
          from: 2019,
          to: 2025,
          authorities: ["CN", "US", "EP"],
        },
        autoSubmit: true,
      },
    },
    {
      chipLabel: "BEV感知技术竞争格局",
      demoText: "BEV感知技术竞争格局",
      description: "填入 BEV 主题词、年份 2020-2025、中美两局，触发分析",
      action: {
        type: "fill_and_search",
        params: {
          query: "BEV感知 鸟瞰图感知",
          from: 2020,
          to: 2025,
          authorities: ["CN", "US"],
        },
        autoSubmit: true,
      },
    },
  ],

  // ── 竞品监控（3 个演示）──
  monitor_configurator: [
    {
      chipLabel: "监控Waymo和特斯拉感知专利",
      demoText: "监控Waymo和特斯拉的多模态感知专利动态",
      description: "打开「新建订阅」弹窗，预填名称/检索式/关联企业/频率每周",
      action: {
        type: "fill_form",
        params: {
          name: "Waymo & Tesla 多模态感知",
          query:
            "(多模态感知 OR multimodal perception OR multi-sensor fusion) AND (自动驾驶 OR autonomous driving)",
          companies: ["Waymo", "Tesla"],
          frequency: "weekly",
        },
        autoSubmit: false,
      },
    },
    {
      chipLabel: "设置传感器融合周报",
      demoText: "设置每周推送传感器融合新专利",
      description: "预填技术主题检索式，频率每周，打开订阅弹窗",
      action: {
        type: "fill_form",
        params: {
          name: "传感器融合周报",
          query:
            "(传感器融合 OR sensor fusion OR 多传感器) AND (激光雷达 OR 摄像头 OR 毫米波)",
          frequency: "weekly",
        },
        autoSubmit: false,
      },
    },
    {
      chipLabel: "中美自动驾驶专利日报",
      demoText: "只看中美两国的自动驾驶最新专利，每天推送",
      description: "预填检索式 + 受理局 CN+US + 频率每日，打开订阅弹窗",
      action: {
        type: "fill_form",
        params: {
          name: "中美自动驾驶日报",
          query:
            "自动驾驶 OR autonomous driving OR 无人驾驶 OR self-driving",
          frequency: "daily",
          authorityFilter: ["CN", "US"],
        },
        autoSubmit: false,
      },
    },
  ],
};

/**
 * 精确匹配 demoText → 返回预设 SkillAction（短路 LLM 调用）。
 * 仅在 userInput 与某个 demoText 完全一致时命中，避免误匹配正常用户输入。
 */
export function findDemoAction(
  skillName: string,
  userInput: string,
): SkillAction | null {
  const cases = SKILL_DEMO_CASES[skillName];
  if (!cases) return null;
  const trimmed = userInput.trim();
  const match = cases.find((c) => c.demoText === trimmed);
  return match?.action ?? null;
}
