"use client";

import React from "react";
import Link from "next/link";
import { Key, Terminal, ArrowUpRight, Cpu, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function QuickActionGrid() {
  const actions = [
    {
      title: "API Key Management",
      description: "Provision, revoke, and inspect developer API keys & scopes.",
      href: "/admin/api-keys",
      icon: Key,
      badge: "Security",
      accent: "hover:border-amber-500/30 text-amber-400 bg-amber-500/10",
    },
    {
      title: "API Documentation",
      description: "Explore endpoints, authentication schemas, and SSE streams.",
      href: "/docs",
      icon: Terminal,
      badge: "Developer",
      accent: "hover:border-blue-500/30 text-blue-400 bg-blue-500/10",
    },
    {
      title: "System Telemetry",
      description: "Review real-time background task execution and agent logs.",
      href: "#",
      icon: Cpu,
      badge: "Infrastructure",
      accent: "hover:border-purple-500/30 text-purple-400 bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Quick Management Actions
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <Link key={idx} href={action.href} className="group block">
              <Card className={`h-full border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 ${action.accent} p-5 flex flex-col justify-between`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${action.accent.split(" ")[1]} ${action.accent.split(" ")[2]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500 group-hover:text-zinc-200 transition-colors">
                      <span className="text-[10px] uppercase font-bold tracking-wider">{action.badge}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                      {action.title}
                    </h4>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
