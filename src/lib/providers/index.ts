/**
 * Provider 工厂 + 降级包装
 *
 * getProvider()：根据 Cookie > 环境变量 > 默认 mock 的优先级返回 Provider 实例及元信息。
 * callProvider()：带降级的调用包装 — Live 失败自动回退 Mock。
 *
 * 模式优先级：
 *   1. 前端通过 Header Toggle 设置的 data-mode Cookie（运行时切换）
 *   2. .env.local 中的 DATA_MODE 环境变量（启动默认值）
 *   3. 兜底 "mock"
 */

import { cookies } from "next/headers";
import { MockProvider } from "./mock";
import { PatsnapProvider } from "./patsnap";
import { AnalyticsMockProvider } from "./mock-analytics";
import { PatsnapAnalyticsProvider } from "./patsnap-analytics";
import type { PatentDataProvider } from "./types";
import type { AnalyticsProvider } from "./analytics-types";

export type { PatentDataProvider, PatentSearchQuery, SemanticSearchQuery, CompanySearchQuery, ProviderKind } from "./types";
export type { AnalyticsProvider, TrendData, WordCloudItem, ApplicantRanking, InnovationRadar } from "./analytics-types";
export { MockProvider } from "./mock";
export { PatsnapProvider } from "./patsnap";
export { AnalyticsMockProvider } from "./mock-analytics";
export { PatsnapAnalyticsProvider } from "./patsnap-analytics";

/** getProvider() 返回的元信息，用于响应头标注和日志 */
export interface ProviderMeta {
  /** 实际生效的 provider 实例 */
  provider: PatentDataProvider;
  /** 实际数据源标识 */
  source: "mock" | "live";
  /** 是否发生了降级回退（请求 live 但因故退回 mock） */
  fallbackTriggered: boolean;
  /** 回退原因（如有） */
  fallbackReason?: string;
}

/**
 * 根据 Cookie / 环境变量创建对应的 Provider 实例及元信息。
 *
 * 优先级：Cookie data-mode > DATA_MODE 环境变量 > 默认 "mock"
 * DATA_MODE=live 但 PATSNAP_API_KEY 缺失 → 回退 Mock + fallbackTriggered=true
 */
export async function getProvider(): Promise<ProviderMeta> {
  // 1. 读取 Cookie（前端 Header toggle 设置）
  let mode: string | undefined;
  try {
    const cookieStore = await cookies();
    mode = cookieStore.get("data-mode")?.value;
  } catch {
    // 非请求上下文（如 build 阶段）cookies() 会抛异常，忽略
  }

  // 2. 回退到环境变量
  if (!mode) {
    mode = process.env.DATA_MODE;
  }

  // 3. 兜底 mock
  if (!mode || mode === "mock") {
    return {
      provider: new MockProvider(),
      source: "mock",
      fallbackTriggered: false,
    };
  }

  // mode === "live"
  const key = process.env.PATSNAP_API_KEY;
  const base = process.env.PATSNAP_API_BASE ?? "https://connect.zhihuiya.com";
  if (!key) {
    console.warn("[providers] DATA_MODE=live but PATSNAP_API_KEY missing, falling back to mock");
    return {
      provider: new MockProvider(),
      source: "mock",
      fallbackTriggered: true,
      fallbackReason: "PATSNAP_API_KEY 未配置",
    };
  }
  return {
    provider: new PatsnapProvider(key, base),
    source: "live",
    fallbackTriggered: false,
  };
}

/**
 * 带降级的 Provider 调用包装。
 *
 * 先用 primary 调用，成功则返回 data + 元信息。
 * 如果 primary 是 patsnap 且失败，自动回退到 MockProvider 再试一次。
 *
 * 返回的 meta 信息供 SessionStore 记录日志（全流程可追溯）。
 */
export async function callProvider<T>(
  primary: PatentDataProvider,
  fn: (p: PatentDataProvider) => Promise<T>,
): Promise<{
  data: T;
  meta: { kind: string; fallbackTriggered: boolean; latencyMs: number; error?: string };
}> {
  const t0 = Date.now();
  try {
    const data = await fn(primary);
    return {
      data,
      meta: { kind: primary.kind, fallbackTriggered: false, latencyMs: Date.now() - t0 },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (primary.kind === "patsnap") {
      console.warn(`[providers] Live call failed, falling back to mock: ${message}`);
      const mock = new MockProvider();
      const data = await fn(mock);
      return {
        data,
        meta: {
          kind: "mock",
          fallbackTriggered: true,
          latencyMs: Date.now() - t0,
          error: message,
        },
      };
    }
    throw err;
  }
}

/**
 * 根据 DATA_MODE 创建对应的 AnalyticsProvider 实例。
 *
 * 优先级与 getProvider() 一致：Cookie data-mode > DATA_MODE 环境变量 > 默认 mock。
 * 返回的 meta 信息供响应头标注和日志使用。
 */
export async function getAnalyticsProvider(): Promise<{
  provider: AnalyticsProvider;
  source: "mock" | "live";
  fallbackTriggered: boolean;
  fallbackReason?: string;
}> {
  // 1. 读取 Cookie
  let mode: string | undefined;
  try {
    const cookieStore = await cookies();
    mode = cookieStore.get("data-mode")?.value;
  } catch {
    // 非请求上下文
  }

  // 2. 回退环境变量
  if (!mode) {
    mode = process.env.DATA_MODE;
  }

  // 3. 兜底 mock
  if (!mode || mode === "mock") {
    return {
      provider: new AnalyticsMockProvider(),
      source: "mock",
      fallbackTriggered: false,
    };
  }

  // mode === "live"
  const key = process.env.PATSNAP_API_KEY;
  const base = process.env.PATSNAP_API_BASE ?? "https://connect.zhihuiya.com";
  if (!key) {
    console.warn("[providers] DATA_MODE=live but PATSNAP_API_KEY missing, falling back to mock analytics");
    return {
      provider: new AnalyticsMockProvider(),
      source: "mock",
      fallbackTriggered: true,
      fallbackReason: "PATSNAP_API_KEY 未配置",
    };
  }
  return {
    provider: new PatsnapAnalyticsProvider(key, base),
    source: "live",
    fallbackTriggered: false,
  };
}
