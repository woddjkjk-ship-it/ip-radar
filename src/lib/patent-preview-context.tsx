"use client";

/**
 * PatentPreviewContext — 全局专利预览 Context
 *
 * 所有页面通过 usePatentPreview() 打开专利预览弹窗，
 * 无需各自管理 useState 对。Provider 在 RootLayout 中挂载。
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { PatentModal } from "@/components/shared/PatentModal";
import type { PatentSummary } from "@/lib/types";

interface PatentPreviewContextValue {
  openPreview: (patent: PatentSummary) => void;
  closePreview: () => void;
}

const PatentPreviewContext = createContext<PatentPreviewContextValue | null>(null);

export function usePatentPreview(): PatentPreviewContextValue {
  const ctx = useContext(PatentPreviewContext);
  if (!ctx) {
    throw new Error("usePatentPreview must be used within <PatentPreviewProvider>");
  }
  return ctx;
}

export function PatentPreviewProvider({ children }: { children: ReactNode }) {
  const [patent, setPatent] = useState<PatentSummary | null>(null);
  const [open, setOpen] = useState(false);

  const openPreview = useCallback((p: PatentSummary) => {
    setPatent(p);
    setOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <PatentPreviewContext.Provider value={{ openPreview, closePreview }}>
      {children}
      <PatentModal patent={patent} open={open} onClose={closePreview} />
    </PatentPreviewContext.Provider>
  );
}
