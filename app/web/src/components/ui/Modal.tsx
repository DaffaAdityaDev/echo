"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/utils/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
  headerActions,
  footer,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    const panel = panelRef.current;

    if (panel) {
      const focusables = getFocusableElements(panel);
      (focusables[0] ?? panel).focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();

        return;
      }

      if (e.key !== "Tab" || !panel) return;

      const focusables = getFocusableElements(panel);

      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();

        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="fixed inset-0 bg-overlay backdrop-blur-sm transition-opacity duration-300 animate-in fade-in cursor-pointer"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-md border border-border bg-elevated p-5 sm:p-6 text-foreground shadow-2xl transition-all duration-300 animate-in zoom-in-95 font-mono crosshair-container outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border shrink-0">
          <div>
            {title && (
              <h2 id={titleId} className="text-base font-bold tracking-tight text-foreground uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="text-xs text-muted mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border border-transparent hover:border-border cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {children != null && <div className={cn("pt-4 min-h-0 overflow-y-auto", bodyClassName)}>{children}</div>}

        {footer && (
          <div
            className={cn(
              "flex items-center justify-end gap-3 pt-4 shrink-0",
              children != null && "mt-4 border-t border-border",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
