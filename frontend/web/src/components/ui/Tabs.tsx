"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  itemClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  itemClassName,
  activeClassName,
  inactiveClassName,
}: TabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold border-b-2 transition-all cursor-pointer",
              itemClassName,
              isActive
                ? (activeClassName ??
                    "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5 font-bold")
                : (inactiveClassName ??
                    "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"),
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
