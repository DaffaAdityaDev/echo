"use client";

import { PackageOpen } from "lucide-react";
import type React from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-border bg-surface rounded-md space-y-3">
      <div className="p-3 bg-surface-hover text-muted rounded-full">
        <PackageOpen className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted mt-1 max-w-sm">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
