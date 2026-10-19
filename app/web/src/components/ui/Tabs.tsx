"use client";

import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { cn } from "@/utils/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Extra content rendered after the label, e.g. a count badge. */
  trailing?: React.ReactNode;
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  /** Id of the element rendered with `role="tabpanel"`; links each tab to it via aria-controls. */
  panelId?: string;
  className?: string;
  itemClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

const NAVIGATION_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];

function nextTabIndex(key: string, current: number, count: number): number {
  if (key === "Home") return 0;

  if (key === "End") return count - 1;

  const step = key === "ArrowRight" ? 1 : -1;

  return (current + step + count) % count;
}

export function tabElementId(panelId: string, tabId: string): string {
  return `${panelId}-tab-${tabId}`;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  panelId,
  className,
  itemClassName,
  activeClassName,
  inactiveClassName,
}: TabsProps<T>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!NAVIGATION_KEYS.includes(e.key)) return;

    e.preventDefault();
    const next = nextTabIndex(e.key, index, tabs.length);
    onChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex items-center gap-2", className)}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={panelId ? tabElementId(panelId, tab.id) : undefined}
            aria-controls={panelId}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-2 text-xs font-semibold border-b-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
              itemClassName,
              isActive
                ? (activeClassName ?? "border-accent text-accent bg-accent-soft font-bold")
                : (inactiveClassName ?? "border-transparent text-muted hover:text-foreground"),
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.trailing}
          </button>
        );
      })}
    </div>
  );
}
