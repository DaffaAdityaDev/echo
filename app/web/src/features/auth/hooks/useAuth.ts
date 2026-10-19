import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AUTH_QUERY_KEYS } from "../constants";
import { authApi } from "../services/auth-api";
import { useAuthStore } from "../stores/authStore";
import { resetUserStores } from "../stores/resetUserStores";
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
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: true,
  });

  useEffect(() => {
    setUser(user ?? null);
  }, [user, setUser]);

  const loginMutation = useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: authApi.login,
    // Returning the promise makes loginAsync wait for /me to refetch, so the
    // AuthGuard never sees the stale 401 and bounces back to /login.
    onSuccess: () => {
      resetUserStores();

      return queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.ME });
    },
    onError: () => {
      clearAuth();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearAuth();
      resetUserStores();
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
