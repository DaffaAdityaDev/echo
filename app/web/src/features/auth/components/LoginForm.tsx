"use client";

import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { LoginCredentials, LoginResponse } from "../types";

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface LoginFormProps {
  loginAsync: (credentials: LoginCredentials) => Promise<LoginResponse>;
  isLoggingIn: boolean;
  loginError: Error | null;
}

const INTERNAL_REDIRECT_ROUTES = ["/traces", "/session", "/prompts", "/maturity", "/docs"];

function isSafeRedirect(redirect: string): boolean {
  return (
    redirect.startsWith("/") &&
    !redirect.startsWith("//") &&
    (redirect === "/" || INTERNAL_REDIRECT_ROUTES.some((route) => redirect.startsWith(route)))
  );
}

export function LoginForm({ loginAsync, isLoggingIn, loginError }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const validate = () => {
    const newErrors: LoginFormErrors = {};

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
      router.push(isSafeRedirect(redirect) ? redirect : "/");
    } catch {
      // Ignored: mutation error is captured by useAuth's loginMutation and rendered via loginError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-semibold text-foreground">
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            autoComplete="email"
            autoFocus
          />
        </div>
        {errors.email && (
          <p id="email-error" className="text-xs text-danger animate-in">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-semibold text-foreground">
          Password
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-danger animate-in">
            {errors.password}
          </p>
        )}
      </div>

      {loginError && (
        <div
          role="alert"
          className="rounded-md bg-danger/10 border border-danger/20 px-4 py-3 text-xs text-danger animate-in"
        >
          {loginError.message || "Invalid credentials. Please try again."}
        </div>
      )}

      <Button type="submit" size="lg" isLoading={isLoggingIn} className="w-full">
        {isLoggingIn ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
