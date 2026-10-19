"use client";

import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/utils/cn";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

interface DropdownMenuProps {
  label: string;
  icon: LucideIcon;
  items: readonly DropdownMenuItem[];
  triggerClassName?: string;
}

function focusItem(menu: HTMLElement | null, index: number): void {
  const items = menu?.querySelectorAll<HTMLElement>('[role="menuitem"]');

  if (!items || items.length === 0) return;
  items[(index + items.length) % items.length].focus();
}

function focusedItemIndex(menu: HTMLElement | null): number {
  const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  return items.findIndex((item) => item === document.activeElement);
}

export function DropdownMenu({ label, icon: Icon, items, triggerClassName }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    focusItem(menuRef.current, 0);

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = focusedItemIndex(menuRef.current);

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(menuRef.current, current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(menuRef.current, current - 1);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const handleSelect = (item: DropdownMenuItem) => {
    close();
    item.onSelect();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={triggerClassName}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full mt-1.5 z-40 min-w-44 rounded-md border border-border bg-elevated p-1 shadow-xl animate-in fade-in"
        >
          {items.map((item) => {
            const ItemIcon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => handleSelect(item)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs text-foreground text-left cursor-pointer",
                  "hover:bg-surface-hover focus:bg-accent-soft focus:text-accent focus:outline-none",
                )}
              >
                {ItemIcon && <ItemIcon className="h-4 w-4 text-muted" aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
