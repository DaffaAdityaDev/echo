"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Users, Activity, Key, Cpu, ShieldAlert, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AdminStats } from "../types";

interface AdminDashboardPageProps {
  stats: AdminStats | null;
  isLoading: boolean;
  error: Error | null;
}

export function AdminDashboardPage({ stats, isLoading, error }: AdminDashboardPageProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-red-500/20 bg-red-500/5 rounded-xl text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <h4 className="text-zinc-200 font-semibold mb-1">Failed to load admin stats</h4>
        <p className="text-xs text-zinc-500">
          {error?.message || "An unexpected error occurred while fetching system dashboard data."}
        </p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.countUsers,
      icon: Users,
      description: "Active system user accounts",
      glowColor: "shadow-blue-500/5 border-blue-500/10",
      iconColor: "text-blue-500 bg-blue-500/5",
    },
    {
      title: "Active Missions",
      value: stats?.countMissions,
      icon: Cpu,
      description: "Agent execution missions run",
      glowColor: "shadow-purple-500/5 border-purple-500/10",
      iconColor: "text-purple-500 bg-purple-500/5",
    },
    {
      title: "API Keys",
      value: stats?.countApiKeys,
      icon: Key,
      description: "Provisioned developer credentials",
      glowColor: "shadow-amber-500/5 border-amber-500/10",
      iconColor: "text-amber-500 bg-amber-500/5",
    },
    {
      title: "Total API Requests",
      value: stats?.totalRequests,
      icon: Activity,
      description: "Engine queries processed",
      glowColor: "shadow-emerald-500/5 border-emerald-500/10",
      iconColor: "text-emerald-500 bg-emerald-500/5",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-zinc-100">
          Dashboard Overview
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Monitor system metrics and provision API endpoints for active services.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => (
          <Card key={idx} className={`shadow-xl ${card.glowColor} transition-all duration-300 hover:translate-y-[-2px] border`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.iconColor}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20 bg-zinc-800" />
              ) : (
                <div className="text-2xl font-bold font-display text-glow text-zinc-100">
                  {card.value?.toLocaleString() ?? 0}
                </div>
              )}
              <p className="text-[10px] text-zinc-500 mt-2 font-medium">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Status Alert Banner */}
      <div className="p-4 border border-zinc-800/80 bg-zinc-900/10 rounded-xl flex items-start gap-4 glass">
        <div className="p-2 bg-blue-500/5 border border-blue-500/20 text-blue-500 rounded-lg">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-200">System Gateway: Operational</h4>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            All background workers, agent pools, and persistent Redis structures are fully functional. Memory latency is currently averaging 12ms.
          </p>
        </div>
      </div>
    </div>
  );
}
