"use client";

import { BookOpen, ChevronDown, ChevronRight, Code, HelpCircle, Settings, Terminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { useSpec } from "./OpenApiSpecProvider";

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string; href: string }[];
}

interface DocsSidebarProps {
  onNavigate?: () => void;
}

export function DocsSidebar({ onNavigate }: DocsSidebarProps) {
  const { spec } = useSpec();
  const pathname = usePathname();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "getting-started": true,
    guides: true,
    reference: true,
  });

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (href: string) => pathname === href;

  const navSections: NavSection[] = [
    {
      id: "getting-started",
      label: "Getting Started",
      icon: <BookOpen size={13} aria-hidden="true" />,
      children: [
        { id: "overview", label: "Overview", href: "/docs" },
        { id: "quickstart", label: "Quick Start", href: "/docs/quickstart" },
      ],
    },
    {
      id: "guides",
      label: "Integration Guides",
      icon: <Terminal size={13} aria-hidden="true" />,
      children: [
        { id: "authentication", label: "Authentication", href: "/docs/guides/authentication" },
        { id: "chat", label: "Chat API", href: "/docs/guides/chat" },
        { id: "sessions", label: "Sessions", href: "/docs/guides/sessions" },
        { id: "settings", label: "Settings & Config", href: "/docs/guides/settings" },
        { id: "missions", label: "HITL / Missions", href: "/docs/guides/missions" },
      ],
    },
    {
      id: "reference",
      label: "API Reference",
      icon: <Code size={13} aria-hidden="true" />,
      children: [
        { id: "endpoints", label: "All Endpoints", href: "/docs/reference" },
        ...(spec?.tags.map((t) => ({
          id: `tag-${t.name}`,
          label: t.name,
          href: `/docs/reference/${t.name.toLowerCase()}`,
        })) || []),
      ],
    },
    {
      id: "examples",
      label: "Examples",
      icon: <Settings size={13} aria-hidden="true" />,
      children: [
        { id: "curl", label: "cURL", href: "/docs/examples/curl" },
        { id: "python", label: "Python", href: "/docs/examples/python" },
        { id: "nodejs", label: "Node.js", href: "/docs/examples/nodejs" },
      ],
    },
    {
      id: "troubleshooting",
      label: "Troubleshooting",
      icon: <HelpCircle size={13} aria-hidden="true" />,
      children: [{ id: "errors", label: "Error Codes", href: "/docs/troubleshooting" }],
    },
  ];

  return (
    <nav
      aria-label="Documentation"
      className="w-64 shrink-0 border-r border-border bg-elevated overflow-y-auto font-mono text-xs h-full shadow-xs"
    >
      <div className="p-4 space-y-3">
        {navSections.map((section) => {
          const isExpanded = expanded[section.id];

          return (
            <div key={section.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 px-2 py-1 text-2xs font-bold uppercase tracking-wider text-foreground hover:text-accent transition-colors cursor-pointer"
              >
                <span className="text-muted" aria-hidden="true">
                  {section.icon}
                </span>
                <span className="flex-1 text-left">{section.label}</span>
                {isExpanded ? (
                  <ChevronDown size={11} className="text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight size={11} className="text-muted" aria-hidden="true" />
                )}
              </button>
              {isExpanded && section.children && (
                <div className="ml-1.5 space-y-0.5 border-l border-border pl-2">
                  {section.children.map((child) => (
                    <Link
                      key={child.id}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={isActive(child.href) ? "page" : undefined}
                      className={cn(
                        "block px-2.5 py-1.5 rounded-xs text-xs font-mono font-medium transition-all",
                        isActive(child.href)
                          ? "bg-accent-soft text-accent font-bold border-l-2 border-accent shadow-xs"
                          : "text-foreground hover:text-accent hover:bg-surface-hover",
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
