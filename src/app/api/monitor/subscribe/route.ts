/**
 * GET  /api/monitor/subscribe — 获取订阅列表
 * POST /api/monitor/subscribe — 创建专利监控（P056）
 *
 * POST Body: { name: string, query: string, frequency?: string }
 * POST 响应: { monitorId: string }
 *
 * 订阅数据存储在服务端内存（Demo 阶段），生产化时换持久化存储。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ── 服务端内存存储 ──

interface MonitorSubscription {
  id: string;
  name: string;
  query: string;
  frequency: string;
  createdAt: string;
  status: "active" | "inactive";
}

const subscriptions = new Map<string, MonitorSubscription>();

// ── GET: 获取订阅列表 ──

export async function GET(): Promise<NextResponse> {
  try {
    const items = Array.from(subscriptions.values());
    return NextResponse.json({ subscriptions: items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: 创建订阅 ──

const BodySchema = z.object({
  name: z.string().min(1),
  query: z.string().min(1),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, query, frequency } = parsed.data;
  const monitorId = `mon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  subscriptions.set(monitorId, {
    id: monitorId,
    name,
    query,
    frequency,
    createdAt: new Date().toISOString(),
    status: "active",
  });

  return NextResponse.json({ monitorId });
}
