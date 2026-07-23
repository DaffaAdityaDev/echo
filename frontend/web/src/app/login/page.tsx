"use client";

import { Suspense } from "react";
import { useAuth, LoginForm } from "@/features/auth";
import { ShieldCheck } from "lucide-react";

function LoginContent() {
  const { loginAsync, isLoggingIn, loginError } = useAuth();
  return (
    <LoginForm
      loginAsync={loginAsync}
      isLoggingIn={isLoggingIn}
      loginError={loginError}
    />
  );
}

export default function LoginRoute() {
  return (
    <div className="min-h-screen bg-zinc-950 text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-1">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-white">
            Welcome to ECHO
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Sign in to access the agent execution harness and management dashboard.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-xl">
          <Suspense fallback={<div className="text-center text-zinc-400 text-sm py-4">Loading form...</div>}>
            <LoginContent />
          </Suspense>
        </div>

        <p className="text-center text-[11px] text-zinc-600">
          © 2026 Echo Engine — Autonomous AI Harness Platform
        </p>
      </div>
    </div>
  );
}
