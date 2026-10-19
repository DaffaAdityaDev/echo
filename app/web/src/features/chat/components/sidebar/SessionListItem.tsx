"use client";

import { Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import type { Session } from "../../types";

interface SessionListItemProps {
  session: Session;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const ROW_ACTION = "p-1 rounded-sm transition-colors shrink-0 cursor-pointer";

export function SessionListItem({ session, isActive, onSelect, onDelete }: SessionListItemProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRef = useRef(false);

  // Keep keyboard focus on the row as it swaps between normal and confirm mode.
  useEffect(() => {
    if (isConfirmingDelete) cancelRef.current?.focus();
    else if (wasConfirmingRef.current) deleteRef.current?.focus();
    wasConfirmingRef.current = isConfirmingDelete;
  }, [isConfirmingDelete]);

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-1 px-3 py-2 rounded-sm text-xs font-medium transition-all relative",
        isActive
          ? "bg-surface-hover text-foreground font-semibold"
          : "text-muted hover:text-foreground hover:bg-surface-hover/70",
      )}
    >
      {isConfirmingDelete ? (
        <>
          <span className="flex-1 min-w-0 truncate text-danger" role="status">
            Delete this chat?
          </span>
          <button
            type="button"
            onClick={() => onDelete(session.id)}
            className={cn(ROW_ACTION, "text-danger hover:bg-danger/10")}
            aria-label={`Confirm delete ${session.title}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => setIsConfirmingDelete(false)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              setIsConfirmingDelete(false);
            }}
            className={cn(ROW_ACTION, "text-muted hover:text-foreground hover:bg-surface-hover")}
            aria-label="Cancel delete"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelect(session.id)}
            className="flex-1 min-w-0 text-left cursor-pointer rounded-sm"
            title={`Open ${session.title}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="truncate pr-2 block">{session.title}</span>
          </button>
          <button
            ref={deleteRef}
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className={cn(
              ROW_ACTION,
              "text-muted hover:text-danger hover:bg-danger/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
            )}
            aria-label={`Delete ${session.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
