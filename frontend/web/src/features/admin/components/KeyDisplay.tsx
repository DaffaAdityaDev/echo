"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";

interface KeyDisplayProps {
  apiKey: string;
  onClose: () => void;
}

export function KeyDisplay({ apiKey, onClose }: KeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(true);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy API key: ", err);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative overflow-hidden animate-in">
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500" />
      
      <div className="flex items-center gap-3 text-amber-500 mb-4">
        <AlertTriangle className="h-5 w-5" />
        <h4 className="font-semibold text-zinc-100 font-display">Save your API key</h4>
      </div>

      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
        Please copy this key and save it somewhere secure. For security reasons,{" "}
        <strong className="text-zinc-200">you will not be able to see it again</strong>.
      </p>

      <div className="flex items-center gap-2 bg-black/40 border border-zinc-800/80 rounded-lg p-3 font-mono text-sm text-zinc-100 select-all mb-6">
        <span className="flex-1 break-all select-all font-mono">
          {reveal ? apiKey : "••••••••••••••••••••••••••••••••••••••••"}
        </span>
        <button
          type="button"
          onClick={() => setReveal(!reveal)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          title={reveal ? "Hide Key" : "Show Key"}
        >
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          title="Copy to clipboard"
        >
          {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose} variant="secondary">
          Done & Close
        </Button>
      </div>
    </div>
  );
}
