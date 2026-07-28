"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'
import { useSpec } from './OpenApiSpecProvider'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code,
  HelpCircle,
  Settings,
  Terminal,
} from 'lucide-react'

interface NavSection {
  id: string
  label: string
  icon: React.ReactNode
  children?: { id: string; label: string; href: string }[]
}

export function DocsSidebar() {
  const { spec } = useSpec()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'getting-started': true,
    'guides': true,
    'reference': true,
  })

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isActive = (href: string) => pathname === href

  const navSections: NavSection[] = [
    {
      id: 'getting-started',
      label: 'Getting Started',
      icon: <BookOpen size={13} />,
      children: [
        { id: 'overview', label: 'Overview', href: '/docs' },
        { id: 'quickstart', label: 'Quick Start', href: '/docs/quickstart' },
      ],
    },
    {
      id: 'guides',
      label: 'Integration Guides',
      icon: <Terminal size={13} />,
      children: [
        { id: 'authentication', label: 'Authentication', href: '/docs/guides/authentication' },
        { id: 'chat', label: 'Chat API', href: '/docs/guides/chat' },
        { id: 'sessions', label: 'Sessions', href: '/docs/guides/sessions' },
        { id: 'settings', label: 'Settings & Config', href: '/docs/guides/settings' },
        { id: 'missions', label: 'HITL / Missions', href: '/docs/guides/missions' },
      ],
    },
    {
      id: 'reference',
      label: 'API Reference',
      icon: <Code size={13} />,
      children: [
        { id: 'endpoints', label: 'All Endpoints', href: '/docs/reference' },
        ...(spec?.tags.map((t) => ({
          id: `tag-${t.name}`,
          label: t.name,
          href: `/docs/reference/${t.name.toLowerCase()}`,
        })) || []),
      ],
    },
    {
      id: 'examples',
      label: 'Examples',
      icon: <Settings size={13} />,
      children: [
        { id: 'curl', label: 'cURL', href: '/docs/examples/curl' },
        { id: 'python', label: 'Python', href: '/docs/examples/python' },
        { id: 'nodejs', label: 'Node.js', href: '/docs/examples/nodejs' },
      ],
    },
    {
      id: 'troubleshooting',
      label: 'Troubleshooting',
      icon: <HelpCircle size={13} />,
      children: [
        { id: 'errors', label: 'Error Codes', href: '/docs/troubleshooting' },
      ],
    },
  ]

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-white overflow-y-auto font-mono text-xs h-full shadow-xs">
      <div className="p-4 space-y-3">
        {navSections.map((section) => {
          const isExpanded = expanded[section.id]
          return (
            <div key={section.id} className="space-y-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <span className="text-slate-500">{section.icon}</span>
                <span className="flex-1 text-left">{section.label}</span>
                {isExpanded ? <ChevronDown size={11} className="text-slate-400" /> : <ChevronRight size={11} className="text-slate-400" />}
              </button>
              {isExpanded && section.children && (
                <div className="ml-1.5 space-y-0.5 border-l border-border pl-2">
                  {section.children.map((child) => (
                    <Link
                      key={child.id}
                      href={child.href}
                      className={cn(
                        'block px-2.5 py-1.5 rounded-xs text-xs font-mono font-medium transition-all',
                        isActive(child.href)
                          ? 'bg-blue-50 text-blue-700 font-bold border-l-2 border-blue-600 shadow-xs'
                          : 'text-slate-700 hover:text-blue-600 hover:bg-slate-100/80'
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}


