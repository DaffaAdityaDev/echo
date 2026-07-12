"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginRoute() {
  const { loginAsync, isLoggingIn, loginError } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-sm text-zinc-400">Welcome back to Echo</p>
        </div>
        <LoginForm loginAsync={loginAsync} isLoggingIn={isLoggingIn} loginError={loginError} />
      </div>
    </div>
  );
}
