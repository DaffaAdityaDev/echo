import type { ReactNode } from "react";

interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-sm bg-surface-hover border border-border text-foreground font-mono text-2xs">
      {children}
    </kbd>
  );
}
