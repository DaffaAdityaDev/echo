"use client";

import { ChevronDown, ChevronRight, GitBranch, Loader2, UserCheck, XCircle } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/utils/cn";

interface TreeNode {
  id: string;
  name: string;
  instruction: string;
  status: "calling" | "completed" | "failed";
  children: TreeNode[];
  result?: string;
}

interface AgentExecutionTreeProps {
  tree: TreeNode[];
  isRunning: boolean;
  className?: string;
}

function TreeNodeCard({ node, depth, isRunning }: { node: TreeNode; depth: number; isRunning: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  const statusIcon = () => {
    switch (node.status) {
      case "completed":
        return <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
      case "calling":
        return <Loader2 className="h-4 w-4 text-blue-600 shrink-0 animate-spin" />;
    }
  };

  const statusDot = () => {
    switch (node.status) {
      case "completed":
        return "bg-emerald-500";
      case "failed":
        return "bg-red-500";
      case "calling":
        return "bg-blue-500 animate-pulse";
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-start gap-2 p-3 rounded-xl border transition-colors",
          node.status === "completed" && "border-emerald-200 bg-emerald-50/50",
          node.status === "failed" && "border-red-200 bg-red-50/50",
          node.status === "calling" && "border-blue-200 bg-blue-50/50",
        )}
      >
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          {hasChildren && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-0.5 hover:bg-zinc-200 rounded transition-colors"
              aria-label={collapsed ? "Expand branch" : "Collapse branch"}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </button>
          )}
          {statusIcon()}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-700">{node.name}</span>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot())} />
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">{node.instruction}</p>
          {node.result && <p className="text-xs text-zinc-400 font-mono mt-1 line-clamp-2">{node.result}</p>}
        </div>
      </div>
      {hasChildren && !collapsed && (
        <div className="ml-4 pl-4 border-l-2 border-zinc-200 space-y-2 mt-2">
          {node.children.map((child) => (
            <TreeNodeCard key={child.id} node={child} depth={depth + 1} isRunning={isRunning} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentExecutionTree({ tree, isRunning, className }: AgentExecutionTreeProps) {
  return (
    <div className={cn("border border-zinc-200 bg-zinc-50/80 rounded-2xl p-5 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-zinc-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Agent Execution Tree</h3>
        {isRunning && <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin ml-auto" />}
      </div>
      {tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <GitBranch className="h-6 w-6 text-zinc-300 mb-2" />
          <p className="text-xs text-zinc-400">No agent delegation data yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((node) => (
            <TreeNodeCard key={node.id} node={node} depth={0} isRunning={isRunning} />
          ))}
        </div>
      )}
    </div>
  );
}
