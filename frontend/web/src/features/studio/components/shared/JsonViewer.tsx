"use client";

import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import React, { useState } from "react";

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
}

export function JsonViewer({ data, maxHeight = "max-h-96" }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-zinc-200 bg-zinc-50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-100/60">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Payload
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {expanded && (
        <pre className={`p-3 text-xs text-zinc-800 font-mono overflow-auto ${maxHeight} whitespace-pre-wrap break-all`}>
          {json}
        </pre>
      )}
    </div>
  );
}
