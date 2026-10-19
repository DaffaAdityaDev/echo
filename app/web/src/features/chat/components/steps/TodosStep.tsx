"use client";

import { AlertTriangle, Check, ListTodo, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ThoughtStep } from "../../types";

interface TodosStepProps {
  step: ThoughtStep;
}

type TodoStatus = NonNullable<ThoughtStep["todos"]>[number]["status"];

function TodoStatusIcon({ status }: { status: TodoStatus }) {
  if (status === "done") return <Check className="h-3 w-3" aria-hidden="true" />;

  if (status === "in_progress") return <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />;

  if (status === "failed") return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;

  return null;
}

const STATUS_BOX: Partial<Record<TodoStatus, string>> = {
  done: "bg-success/15 border-success/50 text-success",
  in_progress: "bg-accent-soft border-accent/50 text-accent",
  failed: "bg-danger/15 border-danger/50 text-danger",
};

export function TodosStep({ step }: TodosStepProps) {
  const todosList = Array.isArray(step.todos) ? step.todos : [];

  if (todosList.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface border border-border px-3.5 py-3">
      <div className="flex items-center gap-2 text-2xs font-bold text-accent uppercase tracking-widest border-b border-border pb-2">
        <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Active Mission Plan</span>
      </div>
      <ul className="flex flex-col gap-2 mt-1">
        {todosList.map((todo) => {
          const isDone = todo.status === "done";

          return (
            <li key={todo.id || todo.description} className="flex items-start gap-2.5 text-xs text-foreground">
              <span
                className={cn(
                  "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  STATUS_BOX[todo.status] ?? "border-border-strong",
                )}
              >
                <TodoStatusIcon status={todo.status} />
              </span>
              <span className={cn("font-semibold truncate", isDone && "line-through text-muted")}>
                <span className="sr-only">{todo.status.replace("_", " ")}: </span>
                {todo.description}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
