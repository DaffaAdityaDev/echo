================================================================================
API Keys & External M2M Integration
================================================================================

Module : Authentication, Developer API & Integration
Service : backend & web
Version : 1.0
Updated : 2026-08-20
================================================================================

Overview
--------

The API Key & External M2M Integration system allows users and external applications
(such as KataraGnosis, CLI tools, webhooks, and third-party automated pipelines) to
authenticate and securely consume Echo agent platform services without relying on
interactive browser cookies or manual JWT session renewal.

This feature adheres to industry best practices (e.g., Stripe, OpenAI, Supabase standards):

- Cryptographically secure keys with recognizable prefix: `echo_sk_live_...`
- One-way hashing: only the SHA-256 hash is persisted in the PostgreSQL database.
- The raw secret key is displayed exactly ONCE upon creation.
- Instant revocation and multi-tenant user isolation.
- Dual-mode authentication middleware supporting both standard user JWT and Bearer API Key.

File Structure
--------------

+-------------------------------------------------------------+-----------------------------------------------------+
| Path | Description |
+-------------------------------------------------------------+-----------------------------------------------------+
| backend/internal/database/schema.go | DDL definition for `api_keys` table and indexes |
| backend/internal/constants/db/apikey.go | SQL query constants and repository error strings |
| backend/internal/constants/auth/apikey.go | API key prefixes, header names, error messages |
| backend/internal/repository/admin/repository.go | Database operations (Create, ListByUserID, Revoke) |
| backend/internal/handler/admin/handler.go | HTTP endpoints: List, Create, Revoke API keys |
| backend/internal/middleware/auth.go | Dual-mode AuthRequired (JWT Cookie / Bearer API Key) |
| backend/internal/router/router.go | API route mounting (/api/v1/api-keys, chat auth) |
| app/web/src/features/settings/types/apiKey.ts | TypeScript type definitions for API keys |
| app/web/src/features/settings/services/apiKeyService.ts | Frontend API client for managing keys |
| app/web/src/features/settings/components/tabs/ApiKeysTab.tsx| Settings tab UI: key table, create modal, copy modal|
| app/KataraGnosis/frontend/src/features/settings/ | Settings view storing Echo API key for integration |
+-------------------------------------------------------------+-----------------------------------------------------+

Database Schema
---------------

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    TEXT          NOT NULL UNIQUE,
    prefix      TEXT          NOT NULL,
    name        TEXT          NOT NULL DEFAULT '',
    scopes      TEXT[]        DEFAULT '{}',
    user_id     TEXT          NOT NULL,
    status      TEXT          NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'revoked')),
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
```

Flow Diagram - Key Generation & One-Time Display
------------------------------------------------

┌───────────────┐ ┌─────────────────┐ ┌────────────┐
│ Echo Web UI │ │ Echo Backend │ │ PostgreSQL │
└───────┬───────┘ └────────┬────────┘ └─────┬──────┘
│ POST /api/v1/api-keys │ │
│ { name: "KataraGnosis" } │ │
│───────────────────────────────►│ │
│ │ 1. rand.Read(24 bytes) │
│ │ 2. fullKey = "echo_sk_live_" │
│ │ 3. keyHash = sha256(fullKey) │
│ │ 4. prefix = "echo_sk_live_.."│
│ │ │
│ │ INSERT INTO api_keys │
│ │─────────────────────────────►│
│ │ │
│ 201 Created │◄─────────────────────────────│
│ { key: "echo_sk_live_...", │
│ api_key: { id, name, ... } } │
│◄───────────────────────────────│
│
│ [Show One-Time Modal]
│ "Copy secret key now. It won't
│ be shown again."

Flow Diagram - External Request Authentication (e.g. KataraGnosis)
------------------------------------------------------------------

┌──────────────────┐ ┌─────────────────┐ ┌────────────┐
│ KataraGnosis / │ │ Echo Backend │ │ PostgreSQL │
│ External Client │ │ (Auth Middleware│ └─────┬──────┘
└────────┬─────────┘ └────────┬────────┘ │
│ POST /api/v1/chat │ │
│ Header: Authorization: │ │
│ Bearer echo_sk_live_abc123... │ │
│─────────────────────────────────►│ │
│ │ 1. Extract bearer token │
│ │ 2. hash = sha256(token) │
│ │ │
│ │ SELECT FROM api_keys │
│ │ WHERE key_hash = hash │
│ │─────────────────────────────►│
│ │ │
│ │ 3. Check status == 'active' │
│ │ 4. Inject userID into ctx │
│ │ 5. Execute Agent pipeline │
│ │◄─────────────────────────────│
│ 200 OK (Agent Response Stream) │
│◄─────────────────────────────────│

Security Governance & Best Practices
------------------------------------

1. **Zero Raw Key Storage**: The raw secret key is never saved to the database or logged in plain text.
2. **Multi-Tenant User Isolation**: Users can only list and revoke API keys associated with their own `user_id`.
3. **Graceful Revocation**: Revoking a key sets `status = 'revoked'` immediately; any subsequent requests with that key are rejected with `401 Unauthorized`.
4. **Scope Enforcement**: Keys may carry optional scopes (e.g. `['chat:read', 'chat:write', 'agent:execute']`) to limit operational privileges.
