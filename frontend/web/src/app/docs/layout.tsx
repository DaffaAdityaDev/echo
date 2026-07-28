"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ArrowLeft, ShieldAlert, Menu, X } from 'lucide-react'
import { OpenApiSpecProvider } from '@/components/docs/OpenApiSpecProvider'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { cn } from '@/utils/cn'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <OpenApiSpecProvider>
      <div className="flex min-h-screen bg-[#f0f4f9] bg-grid-tech font-mono text-foreground flex-col w-full overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full h-[57px] border-b border-border bg-white/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-xs text-slate-600 hover:text-foreground hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="w-8 h-8 rounded-xs bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block text-foreground uppercase">ECHO API DOCS</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Reference & Integration Guide</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ShieldAlert size={14} />
              Admin Console
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
              Back to App
            </Link>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex w-full">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-xs"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar - Docked to Left Corner */}
          <div
            className={cn(
              'fixed lg:sticky top-[57px] left-0 z-30 h-[calc(100vh-57px)] transition-transform duration-200 shrink-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            )}
          >
            <DocsSidebar />
          </div>

          {/* Main Content - Centered */}
          <main className="flex-1 min-w-0 px-6 md:px-12 py-8 pb-24 flex justify-center" id="main-content">
            <div className="w-full max-w-4xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </OpenApiSpecProvider>
  )
}



