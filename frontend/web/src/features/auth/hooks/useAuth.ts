import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH_QUERY_KEYS } from "../constants";
import { authApi } from "../services/auth-api";
import { useAuthStore } from "../stores/authStore";
import type { LoginCredentials, LoginResponse, User } from "../types";

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setUser = useAuthStore((s) => s.setUser);

  const { data: user, isLoading } = useQuery<User, Error>({
    queryKey: AUTH_QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
    enabled: true,
  });

  useEffect(() => {
    setUser(user ?? null);
  }, [user, setUser]);

  const loginMutation = useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: authApi.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.ME });
    },
    onError: () => {
      clearAuth();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      router.push("/login");
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    loginMutation,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
