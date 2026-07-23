"use client";

import React from "react";
import { Users, Activity, Key, Cpu, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "./StatCard";
import { SystemStatusBanner } from "./SystemStatusBanner";
import { QuickActionGrid } from "./QuickActionGrid";
import type { AdminStats } from "../types";

export interface AdminDashboardPageProps {
  stats: AdminStats | null;
  isLoading: boolean;
  isRefetching?: boolean;
  error: Error | null;
  onRefresh?: () => void;
  dataUpdatedAt?: number;
}

export function AdminDashboardPage({
  stats,
  isLoading,
  isRefetching = false,
  error,
  onRefresh,
  dataUpdatedAt,
}: AdminDashboardPageProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 border border-red-500/20 bg-red-500/5 rounded-2xl text-center max-w-lg mx-auto mt-12 backdrop-blur-md space-y-4">
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-zinc-100">Failed to load admin metrics</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-md">
            {error?.message || "An unexpected network or authorization error occurred while fetching dashboard telemetry."}
          </p>
        </div>
        {onRefresh && (
          <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.countUsers,
      icon: Users,
      description: "Active system user accounts provisioned",
      glowColor: "shadow-blue-500/5 border-blue-500/10 hover:border-blue-500/30",
      iconColor: "text-blue-400 bg-blue-500/10",
      badgeText: "Accounts",
    },
    {
      title: "Active Missions",
      value: stats?.countMissions,
      icon: Cpu,
      description: "Agent execution missions processed",
      glowColor: "shadow-purple-500/5 border-purple-500/10 hover:border-purple-500/30",
      iconColor: "text-purple-400 bg-purple-500/10",
      badgeText: "Executions",
    },
    {
      title: "API Keys",
      value: stats?.countApiKeys,
      icon: Key,
      description: "Active developer authorization credentials",
      glowColor: "shadow-amber-500/5 border-amber-500/10 hover:border-amber-500/30",
      iconColor: "text-amber-400 bg-amber-500/10",
      badgeText: "Security",
    },
    {
      title: "API Requests",
      value: stats?.totalRequests,
      icon: Activity,
      description: "Engine API queries served total",
      glowColor: "shadow-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30",
      iconColor: "text-emerald-400 bg-emerald-500/10",
      badgeText: "Traffic",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Dashboard Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-zinc-100">
            Dashboard Overview
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Monitor infrastructure health, user activity, and API provisioning.
          </p>
        </div>
      </div>

      {/* System Status Alert Banner */}
      <SystemStatusBanner
        isOperational={true}
        latencyMs={12}
        lastUpdated={dataUpdatedAt}
        onRefresh={onRefresh}
        isRefetching={isRefetching}
      />

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => (
          <StatCard
            key={idx}
            title={card.title}
            value={card.value}
            icon={card.icon}
            description={card.description}
            glowColor={card.glowColor}
            iconColor={card.iconColor}
            isLoading={isLoading}
            badgeText={card.badgeText}
          />
        ))}
      </div>

      {/* Quick Action Actions Grid */}
      <QuickActionGrid />
    </div>
  );
}
