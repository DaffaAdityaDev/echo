export interface ApiKey {
  id: string;

  name: string;

  prefix: string;

  scopes: string[];

  user_id: string;

  status: "active" | "revoked";

  created_at: string;
}

export interface CreateApiKeyRequest {
  name: string;

  scopes?: string[];
}

export interface CreateApiKeyResponse {
  key: string;

  api_key: ApiKey;
}
