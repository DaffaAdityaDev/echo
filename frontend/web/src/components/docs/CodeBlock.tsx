"use client";

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import echoTheme from "@/lib/docs/echoTheme";
import { Copy, Check, Terminal } from "lucide-react";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  return (
    <div className="relative group my-4 rounded-xs overflow-hidden border border-slate-800 bg-slate-950 font-mono shadow-xs animate-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            {language}
          </span>
        </div>
        
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <SyntaxHighlighter
        style={echoTheme}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem 1.25rem",
          background: "transparent",
        }}
        translate="no"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

