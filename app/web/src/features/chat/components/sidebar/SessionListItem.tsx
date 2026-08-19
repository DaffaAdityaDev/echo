"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Session } from "../../types";

interface SessionListItemProps {
  session: Session;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SessionListItem({ session, isActive, onSelect, onDelete }: SessionListItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all relative",
        isActive
          ? "bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-semibold"
          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/40 dark:hover:bg-zinc-900/40",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        className="flex-1 min-w-0 text-left cursor-pointer"
        title={`Open ${session.title}`}
      >
        <span className="truncate pr-2 block">{session.title}</span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(session.id)}
        className="p-1 rounded-md text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Delete ${session.title}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
