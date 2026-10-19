"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import echoTheme from "@/lib/echo-code-theme";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="relative group my-2.5 rounded-md overflow-hidden border border-code-border bg-code font-mono shadow-sm animate-in">
      <div className="flex items-center justify-between px-4 py-2 bg-code-header border-b border-code-border text-xs select-none">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-accent" aria-hidden="true" />
          <span className="text-2xs font-semibold uppercase tracking-wider text-code-muted font-mono">
            {language || "code"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => copy(code)}
          className="flex items-center gap-1.5 text-2xs font-medium text-code-muted hover:text-code-foreground transition-colors cursor-pointer px-2 py-0.5 rounded-sm hover:bg-code-border/60"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={13} className="text-success" aria-hidden="true" />
              <span className="text-success font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
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
