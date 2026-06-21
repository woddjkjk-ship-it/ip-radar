"use client";

/**
 * Sidebar — 左侧 6 模块导航
 *
 * 使用 next/navigation 的 usePathname 高亮当前路由。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Search,
  Radio,
  Map,
  Zap,
  FileText,
  Send,
  Bookmark,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/search", label: "专利检索", icon: Search },
  { href: "/monitor", label: "竞品监控", icon: Radio },
  { href: "/landscape", label: "技术调研", icon: Map },
  { href: "/copilot", label: "FTO Copilot", icon: Zap },
  { href: "/reports", label: "报告中心", icon: FileText },
  { href: "/bookmarks", label: "我的收藏", icon: Bookmark },
  { href: "/feishu", label: "飞书集成", icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-56 border-r bg-white dark:bg-zinc-950 dark:border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-14 border-b dark:border-zinc-800 shrink-0">
        <Zap className="size-5 text-blue-600" />
        <span className="font-bold text-sm">
          IP Radar
        </span>
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
              {item.href === "/copilot" && (
                <span className="ml-auto rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部版本 */}
      <div className="px-5 py-3 border-t dark:border-zinc-800 shrink-0">
        <p className="text-[10px] text-muted-foreground">
          IP Radar v0.1 · Demo
        </p>
      </div>
    </aside>
  );
}
