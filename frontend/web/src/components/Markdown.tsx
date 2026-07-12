"use client";

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/utils/cn';
import { Copy, Check, Terminal } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface MarkdownProps {
  content: string;
  className?: string;
}

export const Markdown = React.memo(({ content, className }: MarkdownProps) => {
  const processedContent = React.useMemo(() => {
    if (!content) return "";
    return content
      .replace(/\\\[/g, '$$$$')
      .replace(/\\\]/g, '$$$$')
      .replace(/\\\(/g, '$$')
      .replace(/\\\)/g, '$$')
      .replace(/^\s*\[\s+([\s\S]*?)\s+\]\s*$/gm, '$$$$$1$$$$')
      .replace(/(^|\n)(\\begin\{[a-z\*]+\}[\s\S]*?\\end\{[a-z\*]+\})(\n|$)/g, '$1$$$$$2$$$$$3');
  }, [content]);

  return (
    <div className={cn(
      "prose prose-invert max-w-none",
      "prose-p:leading-relaxed prose-p:text-foreground/90",
      "prose-headings:font-display prose-headings:tracking-tight",
      "prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-a:transition-all",
      "prose-code:text-accent/80 prose-code:bg-accent/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
      "prose-blockquote:border-l-accent/30 prose-blockquote:bg-accent/5 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:italic",
      "prose-sm md:prose-base",
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !match && !String(children).includes('\n');
            
            if (!isInline) {
              return (
                <CodeBlock language={language || 'text'} value={String(children).replace(/\n$/, '')} />
              );
            }

            return (
              <code className={cn("bg-white/5 rounded px-1.5 py-0.5 text-accent font-mono text-[0.9em]", className)} translate="no" {...props}>
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 border border-white/5 rounded-xl glass">
                <table className="w-full text-left border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-white/5 border-b border-white/5">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3 text-sm border-t border-white/5 text-foreground/70">{children}</td>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

Markdown.displayName = 'Markdown';

interface CodeBlockProps {
  language: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="relative group my-6 rounded-xl overflow-hidden border border-white/5 bg-surface/50 glass animate-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
        <div className="flex items-center gap-4">
          {/* macOS Style Dots */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-error/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/20" />
          </div>
          <div className="flex items-center gap-1.5 text-muted select-none">
            <Terminal size={12} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{language}</span>
          </div>
        </div>
        
        <button 
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white transition-all active:scale-95"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check size={12} className="text-success" />
              <span className="text-success">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1.5rem',
          background: 'transparent',
          fontSize: '0.85rem',
          lineHeight: '1.7',
        }}
        translate="no"
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
