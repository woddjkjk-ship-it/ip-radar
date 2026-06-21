/**
 * GET /api/landscape — 技术布局分析（5 Tab）
 *
 * Query params:
 *   q: string        技术主题（Mock 模式任意值均返回 BEV 数据）
 *   tab: trend|players|hotwords|status|competition
 *
 * Live 模式：调用 PatsnapAnalyticsProvider（A001/A002/A007/A008），映射为前端兼容格式。
 * Mock 模式：返回 src/fixtures/landscape-bev.ts 丰富数据。
 * competition Tab 不新增 API 调用，基于前几个 Tab 数据合成。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnalyticsProvider } from "@/lib/providers";
import type { AnalyticsProvider } from "@/lib/providers";
import {
  LANDSCAPE_TREND,
  LANDSCAPE_PLAYERS,
  LANDSCAPE_HOTWORDS,
  LANDSCAPE_STATUS,
  LANDSCAPE_COMPETITION,
} from "@/fixtures/landscape-bev";

/** Demo 专属 fixture 映射（DESIGN.md Section 6.14.2） */
const LANDSCAPE_DEMO_MAP: Record<string, string> = {
  "端到端自动驾驶":             "e2e",
  "激光雷达 LiDAR 自动驾驶感知": "lidar",
  "BEV感知 鸟瞰图感知":          "bev",
};

const QuerySchema = z.object({
  q: z.string().min(1, "查询关键词不能为空").default("BEV感知"),
  tab: z.enum(["trend", "players", "hotwords", "status", "competition"]).default("trend"),
  from: z.coerce.number().optional(),
  to: z.coerce.number().optional(),
  authorities: z.string().optional(),
}).refine(
  (data) => {
    if (data.from != null && data.to != null && data.from > data.to) return false;
    return true;
  },
  { message: "起始年份不能大于结束年份", path: ["from"] },
);

// ── 工具函数 ──

/** 检测 Live 分析数据是否为空（用于自动降级判断） */
function isLandscapeDataEmpty(tab: string, data: unknown): boolean {
  const d = data as Record<string, unknown>;
  switch (tab) {
    case "trend": {
      const years = d.years as unknown[] | undefined;
      return !years || years.length === 0;
    }
    case "players": {
      const ranking = d.ranking as unknown[] | undefined;
      return !ranking || ranking.length === 0;
    }
    case "hotwords": {
      const wordCloud = d.wordCloud as unknown[] | undefined;
      return !wordCloud || wordCloud.length === 0;
    }
    case "status": {
      const arr = data as unknown[] | undefined;
      return !arr || arr.length === 0;
    }
    case "competition": {
      const topPlayers = d.topPlayers as unknown[] | undefined;
      return !topPlayers || topPlayers.length === 0;
    }
    default:
      return true;
  }
}

/** 获取 Mock 模式下的 tab 数据（用于降级回退） */
function getMockTabData(tab: string): unknown {
  switch (tab) {
    case "trend":       return LANDSCAPE_TREND;
    case "players":     return LANDSCAPE_PLAYERS;
    case "hotwords":    return LANDSCAPE_HOTWORDS;
    case "status":      return LANDSCAPE_STATUS;
    case "competition": return LANDSCAPE_COMPETITION;
    default:            return null;
  }
}

// ── Live 模式数据映射（AnalyticsProvider 输出 → 前端 fixture 格式）──

async function buildLiveLandscapeData(
  provider: AnalyticsProvider,
  q: string,
  tab: string,
) {
  switch (tab) {
    case "trend": {
      const trendData = await provider.getTrend(q);
      const years = trendData.map((t) => t.year);
      const applications = trendData.map((t) => t.applicationCount);
      const grants = trendData.map((t) => t.grantCount);
      const grantRates = trendData.map((t) => t.grantRate);
      return {
        years,
        applications,
        grants,
        grantRates,
        // Live 模式下无法按受理局拆分，保持兼容占位
        byCn: applications.map(() => 0),
        byUs: applications.map(() => 0),
        byEp: applications.map(() => 0),
      };
    }
    case "players": {
      const ranking = await provider.getApplicantRanking(q);
      return {
        ranking: ranking.map((r) => ({
          name: r.applicant,
          count: r.count,
          yoy: "",
          topIpc: "",
        })),
        techComposition: {} as Record<string, Record<string, number>>,
      };
    }
    case "hotwords": {
      const wordCloud = await provider.getWordCloud(q);
      return {
        wordCloud: wordCloud.map((w) => ({
          word: w.word,
          weight: w.weight,
        })),
      };
    }
    case "status": {
      const stats = await provider.getLegalStatusStats(q);
      const total = Object.values(stats).reduce((s, c) => s + c, 0) || 1;
      // 前端期望 { legalStatus: { active: N%, expired: N%, ... } } 格式
      const legalStatus: Record<string, number> = {};
      for (const [status, count] of Object.entries(stats)) {
        legalStatus[status] = Math.round((count / total) * 100);
      }
      return { legalStatus };
    }
    case "competition": {
      // competition 基于 players 数据合成
      const ranking = await provider.getApplicantRanking(q);
      const top5 = ranking.slice(0, 5);

      // HHI (Herfindahl-Hirschman Index)：各玩家份额平方和
      const totalCount = ranking.reduce((s, r) => s + r.count, 0) || 1;
      const hhi = top5.reduce((s, r) => s + Math.pow(r.count / totalCount, 2), 0);

      // 竞争水平判定
      const dominantPlayer = top5[0]?.applicant ?? "未知";
      let competitionLevel = "未知";
      if (hhi > 0.25) competitionLevel = "高度集中（寡头）";
      else if (hhi > 0.15) competitionLevel = "适度集中";
      else if (hhi > 0.05) competitionLevel = "分散竞争";
      else competitionLevel = "高度分散";

      // 空白区：计数最低的几个玩家
      const whiteSpaces = ranking.slice(-3).map((r) => ({
        area: r.applicant,
        reason: `仅 ${r.count} 件专利，竞争密度低`,
      }));

      return {
        hhi,
        dominantPlayer,
        competitionLevel,
        topPlayers: top5.map((r) => r.applicant),
        summary: `共 ${ranking.length} 个主要申请人`,
        whiteSpaces,
      };
    }
    default:
      return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { q, tab } = parsed.data;

  // ── Demo 拦截：q 精确匹配 demo topic → 返回专属 fixture ──
  const demoKey = LANDSCAPE_DEMO_MAP[q ?? ""];
  if (demoKey) {
    const fx = demoKey === "e2e"   ? await import("@/fixtures/landscape-e2e")
      : demoKey === "lidar" ? await import("@/fixtures/landscape-lidar")
      : await import("@/fixtures/landscape-bev");

    const tabData: Record<string, unknown> = {
      trend:       fx.LANDSCAPE_TREND,
      players:     fx.LANDSCAPE_PLAYERS,
      hotwords:    fx.LANDSCAPE_HOTWORDS,
      status:      fx.LANDSCAPE_STATUS,
      competition: fx.LANDSCAPE_COMPETITION,
    };
    return NextResponse.json({ tab, data: tabData[tab] ?? tabData.trend, source: "mock" });
  }

  // ── 获取 AnalyticsProvider ──
  const { provider, source, fallbackTriggered, fallbackReason } = await getAnalyticsProvider();

  // ── Live 模式：调用 Patsnap 分析 API ──
  if (source === "live") {
    try {
      const data = await buildLiveLandscapeData(provider, q ?? "BEV感知", tab);
      if (data === null) {
        return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
      }

      // 检测空数据（分析 API 可能返回空数组），自动降级到 Mock
      const isEmpty = isLandscapeDataEmpty(tab, data);
      if (isEmpty) {
        console.warn(`[landscape] Live analytics returned empty data for tab=${tab}, falling back to mock`);
        const mockData = getMockTabData(tab);
        const response = NextResponse.json({ tab, data: mockData, source: "mock" });
        response.headers.set("X-Data-Source", "mock");
        response.headers.set("X-Fallback-Reason", "Live analytics returned empty data");
        return response;
      }

      const response = NextResponse.json({ tab, data, source });
      response.headers.set("X-Data-Source", source);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[landscape] Live analytics failed for tab=${tab}:`, message);
      // 降级到 Mock
      const mockData = getMockTabData(tab);
      const response = NextResponse.json({ tab, data: mockData, source: "mock" });
      response.headers.set("X-Data-Source", "mock");
      response.headers.set("X-Fallback-Reason", `Live error: ${message}`);
      return response;
    }
  }

  // ── Mock 模式：返回 fixture 数据 ──
  switch (tab) {
    case "trend":
      return NextResponse.json({ tab, data: LANDSCAPE_TREND, source });
    case "players":
      return NextResponse.json({ tab, data: LANDSCAPE_PLAYERS, source });
    case "hotwords":
      return NextResponse.json({ tab, data: LANDSCAPE_HOTWORDS, source });
    case "status":
      return NextResponse.json({ tab, data: LANDSCAPE_STATUS, source });
    case "competition":
      return NextResponse.json({ tab, data: LANDSCAPE_COMPETITION, source });
    default:
      return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
  }
}
