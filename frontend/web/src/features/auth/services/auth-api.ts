import { api } from "@/lib/api-client";
import { AUTH_ENDPOINTS } from "../constants";
import type { LoginCredentials, LoginResponse, User } from "../types";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return api.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, credentials);
  },

  logout: async (): Promise<{ message: string }> => {
    return api.post<{ message: string }>(AUTH_ENDPOINTS.LOGOUT, {});
  },

  me: async (): Promise<User> => {
    return api.get<User>(AUTH_ENDPOINTS.ME);
  },
};


