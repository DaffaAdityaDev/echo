"use client"

import React from "react"
import { PackageOpen } from "lucide-react"

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-zinc-200 bg-zinc-50/80 rounded-2xl space-y-3">
      <div className="p-3 bg-zinc-200 text-zinc-500 rounded-full">
        <PackageOpen className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
