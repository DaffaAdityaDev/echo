"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { buildLoginUrl } from "@/lib/api-client";
import { useAuth } from "../hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated && pathname !== "/login") {
      router.push(buildLoginUrl(pathname));
    }
  }, [isAuthenticated, isLoading, pathname, router, mounted]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
