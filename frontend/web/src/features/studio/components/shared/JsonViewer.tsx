"use client"

import React, { useState } from "react"
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react"

interface JsonViewerProps {
  data: unknown
  maxHeight?: string
}

export function JsonViewer({ data, maxHeight = "max-h-96" }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const json = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-zinc-800/60 bg-zinc-950/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/40">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Payload
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {expanded && (
        <pre className={`p-3 text-xs text-zinc-300 font-mono overflow-auto ${maxHeight} whitespace-pre-wrap break-all`}>
          {json}
        </pre>
      )}
    </div>
  )
}
