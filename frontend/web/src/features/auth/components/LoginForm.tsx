"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

import { cn } from "@/utils/cn";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
export interface LoginFormProps {
  loginAsync: (data: { email: string; password: string }) => Promise<unknown>;
  isLoggingIn: boolean;
  loginError: Error | null;
}

export function LoginForm({ loginAsync, isLoggingIn, loginError }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }
    if (!password) {
      newErrors.password = "Password is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await loginAsync({ email, password });
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    } catch {
      // error is captured by loginError from the hook
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email
        </label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn("pl-10", errors.email && "border-red-500/50 focus-visible:border-red-500 focus-visible:ring-red-500/30")}
            autoComplete="email"
            autoFocus
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-400 animate-in">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Password
        </label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn("pl-10 pr-10", errors.password && "border-red-500/50 focus-visible:border-red-500 focus-visible:ring-red-500/30")}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-400 animate-in">
            {errors.password}
          </p>
        )}
      </div>

      {loginError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 animate-in">
          {loginError.message || "Invalid credentials. Please try again."}
        </div>
      )}

      <Button type="submit" size="lg" isLoading={isLoggingIn} className="w-full">
        {isLoggingIn ? (
          <>
            <Loader2 size={18} className="animate-spin mr-2" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
