"use client";

import { ArrowLeft, BookOpen, Menu, X } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { DocsSidebar } from "@/features/docs/components/DocsSidebar";
import { OpenApiSpecProvider } from "@/features/docs/components/OpenApiSpecProvider";
import { cn } from "@/utils/cn";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  return (
    <OpenApiSpecProvider>
      <div className="flex min-h-screen bg-surface bg-grid-tech font-mono text-foreground flex-col w-full overflow-x-hidden">
        <header className="sticky top-0 z-40 w-full h-[57px] border-b border-border bg-elevated/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-xs text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
              aria-controls="docs-navigation"
            >
              {sidebarOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
            <div className="w-8 h-8 rounded-xs bg-accent-soft border border-accent/30 text-accent flex items-center justify-center shrink-0">
              <BookOpen className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-sm tracking-tight block text-foreground uppercase">ECHO API DOCS</span>
              <span className="hidden sm:block text-2xs text-muted uppercase font-bold tracking-wider">
                Reference & Integration Guide
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Back to App</span>
              <span className="sm:hidden">App</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 flex w-full">
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              tabIndex={-1}
              className="fixed inset-0 bg-overlay z-30 lg:hidden backdrop-blur-xs cursor-pointer"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div
            id="docs-navigation"
            className={cn(
              "fixed lg:sticky top-[57px] left-0 z-30 h-[calc(100vh-57px)] transition-transform duration-200 shrink-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            )}
          >
            <DocsSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>

          <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-12 py-8 pb-24 flex justify-center" id="main-content">
            <div className="w-full max-w-4xl">{children}</div>
          </main>
        </div>
      </div>
    </OpenApiSpecProvider>
  );
}
