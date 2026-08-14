"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import echoTheme from "@/lib/docs/echoTheme";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="relative group my-2.5 rounded-md overflow-hidden border border-zinc-800 bg-[#0d1117] font-mono shadow-sm animate-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-zinc-800/80 text-xs select-none">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-blue-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            {language || "code"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => copy(code)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-zinc-800/60"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied</span>
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
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem 1.25rem",
          background: "transparent",
          fontSize: "0.84rem",
          lineHeight: "1.6",
        }}
        codeTagProps={{
          style: {
            background: "transparent",
            fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", "JetBrains Mono", monospace',
          },
        }}
        translate="no"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
