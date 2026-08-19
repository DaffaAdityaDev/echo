"use client";

import { ListTodo } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ThoughtStep } from "../../types";

interface TodosStepProps {
  step: ThoughtStep;
}

export function TodosStep({ step }: TodosStepProps) {
  const todosList = Array.isArray(step.todos)
    ? step.todos
    : typeof step.todos === "object" && step.todos !== null
      ? [step.todos]
      : [];

  if (todosList.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <ListTodo className="h-3.5 w-3.5" />
        <span>Active Mission Plan</span>
      </div>
      <div className="flex flex-col gap-2 mt-1">
        {todosList.map((todo) => {
          const isDone = todo.status === "done";
          const isProgress = todo.status === "in_progress";
          const isFailed = todo.status === "failed";

          return (
            <div
              key={todo.id || todo.description}
              className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isDone
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500"
                    : isProgress
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-500 animate-pulse"
                      : isFailed
                        ? "bg-red-500/20 border-red-500/50 text-red-500"
                        : "border-zinc-400 text-transparent",
                )}
              >
                {isDone && <span className="text-[10px]">âœ“</span>}
                {isProgress && <span className="text-[10px] animate-spin">âš¡</span>}
                {isFailed && <span className="text-[10px]">!</span>}
              </div>
              <span className={cn("font-semibold truncate", isDone && "line-through text-zinc-400")}>
                {todo.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
