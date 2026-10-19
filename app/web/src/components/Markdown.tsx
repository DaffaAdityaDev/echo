"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "@/components/CodeBlock";
import { cn } from "@/utils/cn";
import "katex/dist/katex.min.css";

interface MarkdownProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
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

function isString(value: React.ReactNode): value is string {
  return typeof value === "string";
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 3-step token reveal: each new token flickers through scrambled glyphs
// before settling. The scramble is visual only — assistive tech reads the
// real text, and users who prefer reduced motion skip the effect entirely.
const DenoiseToken = React.memo(({ text, isStreaming }: { text: string; isStreaming?: boolean }) => {
  const [denoiseStep, setDenoiseStep] = React.useState<number>(() => (isStreaming && !prefersReducedMotion() ? 0 : 2));

  React.useEffect(() => {
    if (!isStreaming || prefersReducedMotion()) return;

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
    <span className="inline-block whitespace-pre-wrap">
      <span
        aria-hidden="true"
        className={cn(
          "transition-colors duration-100 font-mono font-bold text-accent",
          denoiseStep === 0 ? "opacity-70" : "opacity-90",
        )}
      >
        {displayText}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
});

DenoiseToken.displayName = "DenoiseToken";

// FlowToken Diff-Based Tokenized Text Component
const FlowTokenText = React.memo(({ input, isStreaming }: { input: string; isStreaming?: boolean }) => {
  const tokens = React.useMemo(() => {
    if (!isStreaming || !input) {
      return [{ text: input, source: 0 }];
    }

    const matches = input.match(/\S+|\s+/g);
    const chunks = matches || [input];

    return chunks.map((chunk, index) => ({
      text: chunk,
      source: index,
    }));
  }, [input, isStreaming]);

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

    if (isString(input)) {
      return <FlowTokenText input={input} isStreaming={isStreaming} />;
    }

    if (React.isValidElement(input)) {
      // SAFETY: Valid React elements expose props object containing optional children.
      const props = input.props as { children?: React.ReactNode };

      if (props?.children) {
        // SAFETY: Cloned element maintains component identity and props while swapping processed children.
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

// Streaming state flows through context so the components map stays stable:
// a new map per isStreaming value would remount the whole rendered tree.
const StreamingContext = React.createContext(false);

function AnimatedChildren({ children }: { children?: React.ReactNode }) {
  const isStreaming = React.useContext(StreamingContext);

  return <>{animateMarkdownText(children, isStreaming)}</>;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath];

const REHYPE_PLUGINS = [rehypeKatex];

// Each renderer drops react-markdown's `node` prop so the hast node is never
// spread onto the DOM element.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h1 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h1>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h3>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h4 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h4>
  ),
  h5: ({ node: _node, children, ...props }) => (
    <h5 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h5>
  ),
  h6: ({ node: _node, children, ...props }) => (
    <h6 {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </h6>
  ),
  p: ({ node: _node, children, ...props }) => (
    <p {...props} className="my-1.5 leading-normal">
      <AnimatedChildren>{children}</AnimatedChildren>
    </p>
  ),
  li: ({ node: _node, children, ...props }) => (
    <li {...props} className="my-0.5 leading-normal">
      <AnimatedChildren>{children}</AnimatedChildren>
    </li>
  ),
  blockquote: ({ node: _node, children, ...props }) => (
    <blockquote
      {...props}
      className="my-2 border-l-2 border-accent bg-surface py-1 px-3 rounded-r-sm italic text-muted text-xs"
    >
      <AnimatedChildren>{children}</AnimatedChildren>
    </blockquote>
  ),
  a: ({ node: _node, children, href, ...props }) => (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
      <AnimatedChildren>{children}</AnimatedChildren>
    </a>
  ),
  strong: ({ node: _node, children, ...props }) => (
    <strong {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </strong>
  ),
  em: ({ node: _node, children, ...props }) => (
    <em {...props}>
      <AnimatedChildren>{children}</AnimatedChildren>
    </em>
  ),
  code: ({ node: _node, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const isInline = !match && !String(children).includes("\n");

    if (!isInline) {
      return <CodeBlock language={language || "text"} code={String(children).replace(/\n$/, "")} />;
    }

    return (
      <code
        className={cn(
          "bg-surface-hover text-accent border border-border rounded-sm px-1.5 py-0.5 font-mono text-[0.87em]",
          className,
        )}
        translate="no"
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ node: _node, children, ...props }) => (
    <div className="overflow-x-auto my-3 border border-border rounded-sm bg-elevated">
      <table {...props} className="w-full text-left border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ node: _node, children, ...props }) => (
    <thead {...props} className="bg-surface border-b border-border">
      {children}
    </thead>
  ),
  th: ({ node: _node, children, ...props }) => (
    <th {...props} className="px-3 py-2 text-2xs font-bold uppercase tracking-wider text-inherit">
      {children}
    </th>
  ),
  td: ({ node: _node, children, ...props }) => (
    <td {...props} className="px-3 py-1.5 text-xs md:text-sm border-t border-border text-inherit">
      {children}
    </td>
  ),
};

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
        "prose max-w-none text-inherit font-mono relative text-xs md:text-sm",
        "prose-p:my-1.5 prose-p:leading-normal prose-p:text-inherit",
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-inherit prose-headings:mt-3 prose-headings:mb-1",
        "prose-h1:text-base prose-h1:mt-3 prose-h1:mb-1.5",
        "prose-h2:text-sm prose-h2:mt-2.5 prose-h2:mb-1",
        "prose-h3:text-xs prose-h3:mt-2 prose-h3:mb-1",
        "prose-ul:my-1.5 prose-ul:pl-4 prose-ul:space-y-0.5",
        "prose-ol:my-1.5 prose-ol:pl-4 prose-ol:space-y-0.5",
        "prose-li:my-0.5",
        "prose-a:text-accent prose-a:underline-offset-2 hover:prose-a:underline prose-a:transition-all",
        "prose-code:text-accent prose-code:bg-surface-hover prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:border prose-code:border-border prose-code:before:content-none prose-code:after:content-none",
        "prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:bg-surface prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-sm prose-blockquote:text-muted prose-blockquote:italic",
        "prose-hr:my-3 prose-hr:border-border",
        className,
      )}
    >
      <StreamingContext.Provider value={isStreaming ?? false}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {processedContent}
        </ReactMarkdown>
      </StreamingContext.Provider>
    </div>
  );
});

Markdown.displayName = "Markdown";

export default Markdown;
