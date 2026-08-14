"use client";

import React, { useEffect, useRef } from "react";
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

interface TokenWithSource {
  text: string;
  source: number;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SPECIAL_GLYPHS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~";

function getRandomGlyph(): string {
  // 80% probability for alphabet (a-z, A-Z, 0-9), 20% for special symbols
  if (Math.random() < 0.8) {
    return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return SPECIAL_GLYPHS[Math.floor(Math.random() * SPECIAL_GLYPHS.length)];
}

function scrambleString(target: string, noiseFactor: number): string {
  if (noiseFactor <= 0) return target;

  return target
    .split("")
    .map((char) => {
      if (/\s/.test(char)) return char;
      if (Math.random() < noiseFactor) {
        return getRandomGlyph();
      }
      return char;
    })
    .join("");
}

// 3-Step Robot Denoising Neural Diffusion Token Reveal
const DenoiseToken = React.memo(({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  const [denoiseStep, setDenoiseStep] = React.useState<number>(isStreaming ? 0 : 2);

  React.useEffect(() => {
    if (!isStreaming) {
      setDenoiseStep(2);
      return;
    }

    setDenoiseStep(0);

    const t1 = setTimeout(() => setDenoiseStep(1), 70);
    const t2 = setTimeout(() => setDenoiseStep(2), 140);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isStreaming]);

  const displayText = React.useMemo(() => {
    if (denoiseStep >= 2) return text;
    const noiseFactor = denoiseStep === 0 ? 0.85 : 0.4;
    return scrambleString(text, noiseFactor);
  }, [text, denoiseStep]);

  if (!isStreaming || denoiseStep >= 2) {
    return <span className="inline-block whitespace-pre-wrap">{text}</span>;
  }

  return (
    <span
      className={cn(
        "inline-block whitespace-pre-wrap transition-colors duration-100 font-mono font-bold",
        denoiseStep === 0 && "text-sky-500 dark:text-sky-400 opacity-90 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]",
        denoiseStep === 1 &&
          "text-indigo-500 dark:text-indigo-400 opacity-95 drop-shadow-[0_0_5px_rgba(129,140,248,0.6)]",
      )}
    >
      {displayText}
    </span>
  );
});

DenoiseToken.displayName = "DenoiseToken";

// FlowToken Diff-Based Tokenized Text Component
const FlowTokenText = React.memo(({ input, isStreaming }: { input: string; isStreaming?: boolean }) => {
  const prevInputRef = useRef<string>("");
  const tokensWithSources = useRef<TokenWithSource[]>([]);
  const fullTextRef = useRef<string>("");

  const tokens = React.useMemo(() => {
    if (!isStreaming || !input) {
      return [{ text: input, source: 0 }];
    }

    // Reset if input is empty or shrank
    if (!prevInputRef.current || input.length < prevInputRef.current.length) {
      tokensWithSources.current = [];
      fullTextRef.current = "";
    }

    // Process unique appended diff content
    if (input !== prevInputRef.current) {
      if (fullTextRef.current && input.includes(fullTextRef.current)) {
        const uniqueNewContent = input.slice(fullTextRef.current.length);
        if (uniqueNewContent.length > 0) {
          tokensWithSources.current.push({
            text: uniqueNewContent,
            source: tokensWithSources.current.length,
          });
          fullTextRef.current = input;
        }
      } else {
        tokensWithSources.current = [{ text: input, source: 0 }];
        fullTextRef.current = input;
      }
    }

    return tokensWithSources.current.length > 0 ? tokensWithSources.current : [{ text: input, source: 0 }];
  }, [input, isStreaming]);

  useEffect(() => {
    if (typeof input === "string") {
      prevInputRef.current = input;
    }
  }, [input]);

  if (!isStreaming) {
    return <>{input}</>;
  }

  return (
    <>
      {tokens.map((token) => (
        <DenoiseToken key={`ft-${token.source}`} text={token.text} isStreaming={isStreaming} />
      ))}
    </>
  );
});

FlowTokenText.displayName = "FlowTokenText";

function animateMarkdownText(children: React.ReactNode, isStreaming?: boolean): React.ReactNode {
  if (!isStreaming) return children;

  const processInput = (input: React.ReactNode, keyPrefix = "ft"): React.ReactNode => {
    if (Array.isArray(input)) {
      return input.map((element, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: composite array-index key keeps processInput fragments stable
        <React.Fragment key={`${keyPrefix}-${index}`}>{processInput(element, `${keyPrefix}-${index}`)}</React.Fragment>
      ));
    }
    if (typeof input === "string") {
      return <FlowTokenText input={input} isStreaming={isStreaming} />;
    }
    if (React.isValidElement(input)) {
      const props = input.props as { children?: React.ReactNode };
      if (props?.children) {
        return React.cloneElement(
          input as React.ReactElement<{ children?: React.ReactNode }>,
          {},
          processInput(props.children, keyPrefix),
        );
      }
    }
    return input;
  };

  return processInput(children);
}

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

  const components = React.useMemo(
    () => ({
      h1: ({ children, ...props }: React.ComponentPropsWithoutRef<"h1">) => (
        <h1 {...props}>{animateMarkdownText(children, isStreaming)}</h1>
      ),
      h2: ({ children, ...props }: React.ComponentPropsWithoutRef<"h2">) => (
        <h2 {...props}>{animateMarkdownText(children, isStreaming)}</h2>
      ),
      h3: ({ children, ...props }: React.ComponentPropsWithoutRef<"h3">) => (
        <h3 {...props}>{animateMarkdownText(children, isStreaming)}</h3>
      ),
      h4: ({ children, ...props }: React.ComponentPropsWithoutRef<"h4">) => (
        <h4 {...props}>{animateMarkdownText(children, isStreaming)}</h4>
      ),
      h5: ({ children, ...props }: React.ComponentPropsWithoutRef<"h5">) => (
        <h5 {...props}>{animateMarkdownText(children, isStreaming)}</h5>
      ),
      h6: ({ children, ...props }: React.ComponentPropsWithoutRef<"h6">) => (
        <h6 {...props}>{animateMarkdownText(children, isStreaming)}</h6>
      ),
      p: ({ children, ...props }: React.ComponentPropsWithoutRef<"p">) => (
        <p {...props} className="my-1.5 leading-normal">
          {animateMarkdownText(children, isStreaming)}
        </p>
      ),
      li: ({ children, ...props }: React.ComponentPropsWithoutRef<"li">) => (
        <li {...props} className="my-0.5 leading-normal">
          {animateMarkdownText(children, isStreaming)}
        </li>
      ),
      blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<"blockquote">) => (
        <blockquote
          {...props}
          className="my-2 border-l-2 border-gb-blue bg-slate-50/80 py-1 px-3 rounded-r-xs italic text-slate-600 text-xs"
        >
          {animateMarkdownText(children, isStreaming)}
        </blockquote>
      ),
      a: ({ children, href, ...props }: React.ComponentPropsWithoutRef<"a">) => (
        <a {...props} href={href} target="_blank" rel="noopener noreferrer">
          {animateMarkdownText(children, isStreaming)}
        </a>
      ),
      strong: ({ children, ...props }: React.ComponentPropsWithoutRef<"strong">) => (
        <strong {...props}>{animateMarkdownText(children, isStreaming)}</strong>
      ),
      em: ({ children, ...props }: React.ComponentPropsWithoutRef<"em">) => (
        <em {...props}>{animateMarkdownText(children, isStreaming)}</em>
      ),
      code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<"code">) => {
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : "";
        const isInline = !match && !String(children).includes("\n");

        if (!isInline) {
          return <CodeBlock language={language || "text"} code={String(children).replace(/\n$/, "")} />;
        }

        return (
          <code
            className={cn(
              "bg-surface-hover text-gb-blue border border-border rounded-xs px-1.5 py-0.5 font-mono text-[0.87em]",
              className,
            )}
            translate="no"
            {...props}
          >
            {children}
          </code>
        );
      },
      table: ({ children, ...props }: React.ComponentPropsWithoutRef<"table">) => (
        <div className="overflow-x-auto my-3 border border-border rounded-xs bg-white">
          <table {...props} className="w-full text-left border-collapse">
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }: React.ComponentPropsWithoutRef<"thead">) => (
        <thead {...props} className="bg-slate-50/90 border-b border-border">
          {children}
        </thead>
      ),
      th: ({ children, ...props }: React.ComponentPropsWithoutRef<"th">) => (
        <th {...props} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-inherit">
          {children}
        </th>
      ),
      td: ({ children, ...props }: React.ComponentPropsWithoutRef<"td">) => (
        <td {...props} className="px-3 py-1.5 text-xs md:text-sm border-t border-border text-inherit">
          {children}
        </td>
      ),
    }),
    [isStreaming],
  );

  return (
    <div
      className={cn(
        "prose max-w-none text-inherit font-mono relative text-xs md:text-sm",
        "prose-p:my-1.5 prose-p:leading-normal prose-p:text-inherit",
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-inherit prose-headings:mt-3 prose-headings:mb-1",
        "prose-h1:text-base prose-h1:mt-3 prose-h1:mb-1.5",
        "prose-h2:text-sm prose-h2:mt-2.5 prose-h2:mb-1",
        "prose-h3:text-xs prose-h3:mt-2 prose-h3:mb-1",
        "prose-ul:my-1.5 prose-ul:pl-4 prose-ul:space-y-0.5",
        "prose-ol:my-1.5 prose-ol:pl-4 prose-ol:space-y-0.5",
        "prose-li:my-0.5",
        "prose-a:text-gb-blue prose-a:no-underline hover:prose-a:underline prose-a:transition-all",
        "prose-code:text-gb-blue prose-code:bg-surface-hover prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-xs prose-code:border prose-code:border-border prose-code:before:content-none prose-code:after:content-none",
        "prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-gb-blue prose-blockquote:bg-slate-50/80 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-xs prose-blockquote:text-slate-600 prose-blockquote:italic",
        "prose-hr:my-3 prose-hr:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = "Markdown";

export default Markdown;
