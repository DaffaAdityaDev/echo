import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../services/auth-api";
import { AUTH_QUERY_KEYS } from "../constants";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEYS.ME,
    queryFn: authApi.me,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.ME });
    },
  });



  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
  };
}
