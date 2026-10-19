"use client";

import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { LoginForm, useAuth } from "@/features/auth";

function LoginContent() {
  const { loginAsync, isLoggingIn, loginError } = useAuth();

  return <LoginForm loginAsync={loginAsync} isLoggingIn={isLoggingIn} loginError={loginError} />;
}

export default function LoginRoute() {
  return (
    <main id="main-content" className="flex-1 min-h-0 overflow-y-auto bg-background bg-grid-tech text-foreground">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 py-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-md bg-accent-soft border border-accent/20 text-accent mb-1">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-section text-foreground">Welcome to ECHO</h1>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Sign in to access the agent execution harness and management dashboard.
            </p>
          </div>

          <div className="rounded-md border border-border bg-elevated p-6 sm:p-8 shadow-xl crosshair-container">
            <span className="crosshair-tr" aria-hidden="true">
              +
            </span>
            <span className="crosshair-bl" aria-hidden="true">
              +
            </span>
            <Suspense fallback={<p className="text-center text-muted text-sm py-4">Loading form...</p>}>
              <LoginContent />
            </Suspense>
          </div>

          <p className="text-center text-2xs text-muted">© 2026 Echo Engine — Autonomous AI Harness Platform</p>
        </div>
      </div>
    </main>
  );
}
