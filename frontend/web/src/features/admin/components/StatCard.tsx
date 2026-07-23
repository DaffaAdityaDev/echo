"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";

export interface StatCardProps {
  title: string;
  value?: number;
  icon: LucideIcon;
  description: string;
  glowColor?: string;
  iconColor?: string;
  isLoading?: boolean;
  badgeText?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  glowColor = "shadow-blue-500/5 border-blue-500/10",
  iconColor = "text-blue-500 bg-blue-500/10",
  isLoading = false,
  badgeText,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl border bg-zinc-900/60 backdrop-blur-md group",
        glowColor
      )}
    >
      {/* Background Accent Glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all" />

      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className={cn("p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {isLoading ? (
          <Skeleton className="h-8 w-24 bg-zinc-800/80 rounded-lg" />
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-display tracking-tight text-zinc-100">
              {value !== undefined ? value.toLocaleString() : "0"}
            </span>
            {badgeText && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                {badgeText}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-zinc-500 mt-2 font-medium leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
