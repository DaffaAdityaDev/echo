"use client";

import { motion } from "framer-motion";
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { cn } from "@/utils/cn";
import "katex/dist/katex.min.css";

interface MarkdownProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export const TokenizedText = React.memo(({ text }: { text: string }) => {
  const tokens = React.useMemo(() => {
    if (!text) return [];
    return text.split(/(\s+)/).filter((token) => token !== "");
  }, [text]);

  return (
    <span className="inline">
      {tokens.map((token, index) => {
        const isWhitespace = /^\s+$/.test(token);
        return isWhitespace ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: whitespace tokens are static, no re-animation needed
          <span key={index} style={{ whiteSpace: "pre" }}>
            {token}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static index key prevents re-triggering blur keyframes on sub-word completion
          <span key={index} className="inline-block animate-cursor-reveal">
            {token}
          </span>
        );
      })}
    </span>
  );
});

TokenizedText.displayName = "TokenizedText";

const Markdown = React.memo(({ content, className, isStreaming }: MarkdownProps) => {
  const processedContent = React.useMemo(() => {
    if (!content) return "";
    return content
      .replace(/\\\[/g, "$$$$")
      .replace(/\\\]/g, "$$$$")
      .replace(/\\\(/g, "$$")
      .replace(/\\\)/g, "$$")
      .replace(/^\s*\[\s+([\s\S]*?)\s+\]\s*$/gm, "$$$$$1$$$$")
      .replace(/(^|\n)(\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\})(\n|$)/g, "$1$$$$$2$$$$$3");
  }, [content]);

  return (
    <div
      className={cn(
        "prose max-w-none text-inherit font-mono relative",
        "prose-p:leading-relaxed prose-p:text-inherit",
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-inherit",
        "prose-a:text-gb-blue prose-a:no-underline hover:prose-a:underline prose-a:transition-all",
        "prose-code:text-gb-blue prose-code:bg-surface-hover prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-xs prose-code:border prose-code:border-border prose-code:before:content-none prose-code:after:content-none",
        "prose-blockquote:border-l--gb-blue prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:rounded-r-[2px] prose-blockquote:text-slate-600 prose-blockquote:italic",
        "prose-sm md:prose-base",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p({ children }) {
            if (isStreaming) {
              if (typeof children === "string") {
                return (
                  <p className="my-2 leading-relaxed">
                    <TokenizedText text={children} />
                  </p>
                );
              }
              if (Array.isArray(children)) {
                return (
                  <p className="my-2 leading-relaxed">
                    {children.map((child, idx) =>
                      typeof child === "string" ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: composite array-index key keeps streaming tokens stable
                        <TokenizedText key={`child-${idx}`} text={child} />
                      ) : (
                        child
                      ),
                    )}
                  </p>
                );
              }
            }
            return <p className="my-2 leading-relaxed">{children}</p>;
          },
          li({ children }) {
            if (isStreaming) {
              if (typeof children === "string") {
                return (
                  <li className="my-1">
                    <TokenizedText text={children} />
                  </li>
                );
              }
              if (Array.isArray(children)) {
                return (
                  <li className="my-1">
                    {children.map((child, idx) =>
                      typeof child === "string" ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: composite array-index key keeps streaming tokens stable
                        <TokenizedText key={`child-li-${idx}`} text={child} />
                      ) : (
                        child
                      ),
                    )}
                  </li>
                );
              }
            }
            return <li className="my-1">{children}</li>;
          },
          code({ className, children, ...props }: React.ComponentPropsWithoutRef<"code">) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !match && !String(children).includes("\n");

            if (!isInline) {
              return <CodeBlock language={language || "text"} code={String(children).replace(/\n$/, "")} />;
            }

            return (
              <code
                className={cn(
                  "bg-surface-hover text-gb-blue border border-border rounded-xs px-1.5 py-0.5 font-mono text-[0.9em]",
                  className,
                )}
                translate="no"
                {...props}
              >
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 border border-border rounded-xs bg-white">
                <table className="w-full text-left border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-slate-50 border-b border-border">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-inherit">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3 text-sm border-t border-border text-inherit">{children}</td>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <motion.span
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{
            layout: { type: "spring", stiffness: 400, damping: 30 },
            opacity: { repeat: Infinity, duration: 0.8, ease: "easeInOut" },
          }}
          className="inline-block h-4 w-[2.5px] bg-sky-400 dark:bg-sky-400 ml-1 align-middle shadow-[0_0_8px_rgba(56,189,248,0.9)] rounded-xs"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

Markdown.displayName = "Markdown";

export default Markdown;
