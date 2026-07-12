export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  key?: string; // only present once when generated
  scopes: string[];
  status: "active" | "revoked";
  createdAt: string;
}

export interface AdminStats {
  countUsers: number;
  countMissions: number;
  countApiKeys: number;
  totalRequests: number;
}
