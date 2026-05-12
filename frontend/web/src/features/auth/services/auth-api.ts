import { api } from "@/lib/api-client";
import { AUTH_ENDPOINTS } from "../constants";
import { LoginCredentials } from "../types";

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    return api.post(AUTH_ENDPOINTS.LOGIN, credentials);
  },

  logout: async () => {
    return api.post(AUTH_ENDPOINTS.LOGOUT, {});
  },
  me: async () => {
    return api.get(AUTH_ENDPOINTS.ME);
  }
};


