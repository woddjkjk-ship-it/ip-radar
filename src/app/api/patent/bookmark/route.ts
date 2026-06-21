/**
 * GET/POST/DELETE /api/patent/bookmark — 专利收藏管理
 *
 * GET:    获取已收藏专利列表
 * POST:   Body { patent: PatentSummary } → 添加收藏
 * DELETE: ?patentId=xxx → 移除收藏
 *
 * 数据存储在 cookie `bookmarked-patents`（JSON 序列化），
 * 与前端 localStorage 键 `bookmarked-patents` 对应。
 *
 * 注意：Next.js Route Handler 中必须通过 NextResponse.cookies.set() 设置 cookie，
 * 不能使用 cookies().set()（后者仅用于 Server Actions / Middleware）。
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE_KEY = "bookmarked-patents";
const MAX_BOOKMARKS = 50;

// ── 工具函数 ──

async function getBookmarks(): Promise<unknown[]> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_KEY)?.value;
    if (!raw) return [];
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 在 NextResponse 上设置书签 cookie，返回修改后的 response */
function withBookmarkCookie(response: NextResponse, items: unknown[]): NextResponse {
  response.cookies.set(COOKIE_KEY, encodeURIComponent(JSON.stringify(items)), {
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 天
    sameSite: "lax",
  });
  return response;
}

// ── GET: 获取收藏列表 ──

export async function GET(): Promise<NextResponse> {
  try {
    const items = await getBookmarks();
    return NextResponse.json({ bookmarks: items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST: 添加/移除收藏 ──

const PostSchema = z.object({
  patent: z.object({
    patentId: z.string().min(1),
    pn: z.string(),
    title: z.string(),
    apdt: z.number().optional(),
    pbdt: z.number().optional(),
    authority: z.string().optional(),
    originalAssignee: z.string().optional(),
    currentAssignee: z.string().optional(),
    inventor: z.string().optional(),
    apno: z.string().optional(),
  }),
  action: z.enum(["add", "remove"]).optional().default("add"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid patent data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const items = await getBookmarks();
    const { patent, action } = parsed.data;

    if (action === "remove") {
      const filtered = items.filter(
        (item) => (item as Record<string, unknown>).patentId !== patent.patentId,
      );
      const response = NextResponse.json({
        bookmarks: filtered,
        count: filtered.length,
        removed: patent.patentId,
      });
      return withBookmarkCookie(response, filtered);
    }

    // action === "add"
    // 去重：已存在则移到最前面
    const existingIdx = items.findIndex(
      (item) => (item as Record<string, unknown>).patentId === patent.patentId,
    );
    if (existingIdx >= 0) {
      items.splice(existingIdx, 1);
    }
    items.unshift(patent);
    // 限制最大数量
    if (items.length > MAX_BOOKMARKS) {
      items.length = MAX_BOOKMARKS;
    }

    const response = NextResponse.json({
      bookmarks: items,
      count: items.length,
      added: patent.patentId,
    });
    return withBookmarkCookie(response, items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE: 移除收藏 ──

const DeleteSchema = z.object({
  patentId: z.string().min(1),
});

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const parsed = DeleteSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing patentId" }, { status: 400 });
  }

  try {
    const items = await getBookmarks();
    const { patentId } = parsed.data;
    const filtered = items.filter((item) => (item as Record<string, unknown>).patentId !== patentId);

    const response = NextResponse.json({
      bookmarks: filtered,
      count: filtered.length,
      removed: patentId,
    });
    return withBookmarkCookie(response, filtered);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
