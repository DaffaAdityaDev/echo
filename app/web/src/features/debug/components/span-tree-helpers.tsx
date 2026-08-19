import {
  AlertCircle,
  Bot,
  Brain,
  CheckSquare,
  FileCode,
  Info,
  Network,
  Play,
  RefreshCw,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Span } from "@/features/debug/stores/traceStore";

export interface TreeSpanNode {
  span: Span;
  children: TreeSpanNode[];
  depth: number;
}

export interface VisibleSpanNode {
  node: TreeSpanNode;
  hasChildren: boolean;
}

export function buildSpanTree(spans: Span[]): TreeSpanNode[] {
  const nodeMap = new Map<string, TreeSpanNode>();
  const roots: TreeSpanNode[] = [];
  const uniqueSpans: Span[] = [];
  const seenIds = new Set<string>();

  for (const span of spans) {
    if (!seenIds.has(span.id)) {
      seenIds.add(span.id);
      uniqueSpans.push(span);
      nodeMap.set(span.id, { span, children: [], depth: 0 });
    }
  }

  for (const span of uniqueSpans) {
    const node = nodeMap.get(span.id);
    if (!node) continue;
    const parentNode = span.parentId ? nodeMap.get(span.parentId) : undefined;
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const computeDepth = (node: TreeSpanNode, depth: number) => {
    node.depth = depth;
    node.children.sort((a, b) => a.span.startTime - b.span.startTime);
    for (const child of node.children) {
      computeDepth(child, depth + 1);
    }
  };

  for (const root of roots) {
    computeDepth(root, 0);
  }

  roots.sort((a, b) => a.span.startTime - b.span.startTime);
  return roots;
}

export function getVisibleNodes(spanTree: TreeSpanNode[], collapsedSpans: Set<string>): VisibleSpanNode[] {
  const list: VisibleSpanNode[] = [];

  const traverse = (node: TreeSpanNode) => {
    const hasChildren = node.children.length > 0;
    list.push({ node, hasChildren });
    if (collapsedSpans.has(node.span.id)) return;
    for (const child of node.children) {
      traverse(child);
    }
  };

  for (const root of spanTree) {
    traverse(root);
  }

  return list;
}

export function toggleSpanCollapse(spanId: string, collapsed: Set<string>): Set<string> {
  const next = new Set(collapsed);
  if (next.has(spanId)) {
    next.delete(spanId);
  } else {
    next.add(spanId);
  }
  return next;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}

export function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

export function getSpanIcon(span: Span): ReactNode {
  if (span.name === "Agent Response") {
    return <Bot className="h-3.5 w-3.5" />;
  }
  if (span.name === "Mission Initiated") {
    return <Play className="h-3.5 w-3.5" />;
  }
  if (span.name.startsWith("State Transition")) {
    return <RefreshCw className="h-3.5 w-3.5" />;
  }

  switch (span.type) {
    case "thought":
      return <Brain className="h-3.5 w-3.5" />;
    case "tool":
      return <Wrench className="h-3.5 w-3.5" />;
    case "subagent":
      return <Users className="h-3.5 w-3.5" />;
    case "file_operation":
      return <FileCode className="h-3.5 w-3.5" />;
    case "swarm_status":
      return <Network className="h-3.5 w-3.5" />;
    case "todo":
      return <CheckSquare className="h-3.5 w-3.5" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;
    case "info":
      return <Info className="h-3.5 w-3.5" />;
    default:
      return <Terminal className="h-3.5 w-3.5" />;
  }
}

export function getSpanColorClass(span: Span): string {
  if (span.status === "failed") return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
  if (span.status === "skipped")
    return "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  if (span.status === "streaming") return "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400";

  if (span.name === "Agent Response") {
    return "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400";
  }
  if (span.name === "Mission Initiated") {
    return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
  }
  if (span.name.startsWith("State Transition")) {
    return "bg-zinc-100/60 text-zinc-500 border-zinc-200/50 dark:bg-zinc-900/60 dark:text-zinc-400 dark:border-zinc-800/50";
  }

  switch (span.type) {
    case "thought":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
    case "tool":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400";
    case "subagent":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400";
    case "file_operation":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
    case "swarm_status":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200/80 dark:bg-zinc-900/50 dark:text-zinc-300 dark:border-zinc-800/80";
  }
}
