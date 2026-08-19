"use client";

import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/utils/cn";

interface CopyButtonProps {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  iconClassName?: string;
  title?: string;
}

export function CopyButton({ text, label, copiedLabel = "Copied", className, iconClassName, title }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    copy(text);
  };

  const iconCls = cn("h-3 w-3", iconClassName);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn("flex items-center gap-1.5 transition-colors cursor-pointer", className)}
      title={title}
    >
      {copied ? (
        <Check className={cn(iconCls, "text-emerald-600 dark:text-emerald-400")} />
      ) : (
        <Copy className={iconCls} />
      )}
      <span className={copied ? "text-emerald-600 dark:text-emerald-400" : undefined}>
        {copied ? copiedLabel : label}
      </span>
    </button>
  );
}
