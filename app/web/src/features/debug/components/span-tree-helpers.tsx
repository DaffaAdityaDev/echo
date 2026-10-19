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
import type { JsonValue } from "@/types/json";

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

function isJsonString(val: JsonValue | undefined): val is string {
  return typeof val === "string";
}

export function formatValue(val: JsonValue | undefined): string {
  if (val === null || val === undefined) return "—";

  if (isJsonString(val)) return val;

  return JSON.stringify(val, null, 2);
}

export function getSpanIcon(span: Span): ReactNode {
  if (span.name === "Agent Response") {
    return <Bot className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (span.name === "Mission Initiated") {
    return <Play className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (span.name.startsWith("State Transition")) {
    return <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  switch (span.type) {
    case "thought":
      return <Brain className="h-3.5 w-3.5" aria-hidden="true" />;
    case "tool":
      return <Wrench className="h-3.5 w-3.5" aria-hidden="true" />;
    case "subagent":
      return <Users className="h-3.5 w-3.5" aria-hidden="true" />;
    case "file_operation":
      return <FileCode className="h-3.5 w-3.5" aria-hidden="true" />;
    case "swarm_status":
      return <Network className="h-3.5 w-3.5" aria-hidden="true" />;
    case "todo":
      return <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />;
    case "info":
      return <Info className="h-3.5 w-3.5" aria-hidden="true" />;
    default:
      return <Terminal className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

export function getSpanColorClass(span: Span): string {
  if (span.status === "failed") return "bg-danger/10 text-danger border-danger/20";

  if (span.status === "skipped") return "bg-surface-hover text-muted border-border";

  if (span.status === "streaming") return "bg-success/10 text-success border-success/20";

  if (span.name === "Agent Response") {
    return "bg-accent/10 text-accent border-accent/20";
  }

  if (span.name === "Mission Initiated") {
    return "bg-accent/10 text-accent border-accent/20";
  }

  if (span.name.startsWith("State Transition")) {
    return "bg-surface-hover text-muted border-border";
  }

  switch (span.type) {
    case "thought":
      return "bg-success/10 text-success border-success/20";
    case "tool":
      return "bg-accent/10 text-accent border-accent/20";
    case "subagent":
      return "bg-accent/10 text-accent border-accent/20";
    case "file_operation":
      return "bg-accent/10 text-accent border-accent/20";
    case "swarm_status":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-surface-hover text-foreground border-border";
  }
}
