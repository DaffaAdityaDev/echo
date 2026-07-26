===============================================================================
  Credential Manager - Secure Env Reference System
===============================================================================
  Module    : Credential Manager
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
===============================================================================

## Description

The Credential Manager provides a secure indirection layer between user
configuration and actual credential values. Users reference secrets via
`$env.<NAME>` placeholders in their config. The agent model NEVER sees raw
credential values — they are injected only at `tools/call` execution time.

---

## File Structure

```
infrastructure/credentials/
  manager.ts              # CredentialManager — resolve, validate, cache
  types.ts                # CredentialMapping, CredentialConfig
```

---

## Security Principle

```
  User Config                         Agent Model
  ┌───────────────────┐              ┌───────────────────┐
  │  api_key:          │              │                   │
  │   "$env.DB_TOKEN"  │────ref──────►│  NEVER sees       │
  │                    │              │  resolved value   │
  │  password:         │              │                   │
  │   "$env.DB_PASS"   │              │  Only sees:       │
  │                    │              │  "DB_TOKEN"       │
  │  token:            │              │  "DB_PASS"        │
  │   "$env.API_KEY"   │              │                   │
  └───────────────────┘              └───────────────────┘
          │                                   │
          └──────────┬────────────────────────┘
                     │
                     ▼
       ┌─────────────────────────────────────┐
       │      CredentialManager.resolve()     │
       │                                     │
       │  1. Parse $env.<NAME> references     │
       │  2. Lookup NAME in process.env       │
       │  3. Return resolved value            │
       │  4. (Never log the value)            │
       └──────────────────┬──────────────────┘
                          │
                          ▼
       ┌─────────────────────────────────────┐
       │  Only injected at tools/call time    │
       │                                     │
       │  Transport adapter receives the      │
       │  resolved value, sends it to the     │
       │  external API, never stores it       │
       └─────────────────────────────────────┘
```

---

## Resolution Flow

```
                    ┌─────────────────────────────────────┐
                    │  User provides config with $env refs │
                    │                                     │
                    │  { api_key: "$env.MY_API_KEY" }     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │  Agent receives config (runtime)     │
                    │                                     │
                    │  Config stored in memory with        │
                    │  $env references intact              │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │  Model generates tool call args      │
                    │                                     │
                    │  Model NEVER sees credentials        │
                    │  Model sees schema only              │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │  Transport: callTool()               │
                    │                                     │
                    │  ┌─────────────────────────────────┐ │
                    │  │ CredentialManager.resolve({     │ │
                    │  │   api_key: "$env.MY_API_KEY"   │ │
                    │  │ })                              │ │
                    │  │                                 │ │
                    │  │ 1. Find all $env.<NAME> refs    │ │
                    │  │ 2. process.env["MY_API_KEY"]    │ │
                    │  │ 3. Return {                     │ │
                    │  │      api_key: "sk-real-..."     │ │
                    │  │   }                             │ │
                    │  └─────────────────────────────────┘ │
                    │                                     │
                    │  Resolved creds sent to target API   │
                    │  (never persisted, never logged)     │
                    └──────────────────────────────────────┘
```

---

## Credential Mapping in User Config

```typescript
// Tool/Transport configuration uses $env references
{
  mcp_servers: [
    {
      name: "database",
      url: "https://mcp.example.com/sse",
      credentials: {
        api_key: "$env.DB_MCP_KEY",    // ← env reference
        db_user: "$env.DB_USER",
        db_password: "$env.DB_PASS"
      }
    }
  ],
  rest_tools: [
    {
      name: "search_api",
      url: "https://api.example.com/search",
      headers: {
        "X-API-Key": "$env.SEARCH_API_KEY",  // ← env reference
        "Authorization": "Bearer $env.SEARCH_TOKEN"  // ← inline ref
      }
    }
  ]
}
```

---

## Supported Credential Types

+----------+-----------------------------+---------------------------------------------+
| Type     | Config Pattern              | Transport Behavior                           |
+----------+-----------------------------+---------------------------------------------+
| Bearer   | `headers: {                | Sets `Authorization: Bearer <resolved>`     |
|          |   "Authorization":          |                                             |
|          |   "Bearer $env.TOKEN"      |                                             |
|          | }`                         |                                             |
+----------+-----------------------------+---------------------------------------------+
| Basic    | `headers: {                | Sets `Authorization: Basic <base64>         |
|          |   "Authorization":          |                                             |
|          |   "Basic $env.CREDS"       |                                             |
|          | }`                         |                                             |
+----------+-----------------------------+---------------------------------------------+
| Custom   | `headers: {                | Sets `X-API-Key: <resolved>`               |
| Header   |   "X-API-Key":             |                                             |
|          |   "$env.API_KEY"           |                                             |
|          | }`                         |                                             |
+----------+-----------------------------+---------------------------------------------+
| URL      | `url: "https://$env.       | Resolves host/token in URL                  |
| Param    |   HOST/api?token=$env.     |                                             |
|          |   TOKEN"`                  |                                             |
+----------+-----------------------------+---------------------------------------------+

---

## API

```typescript
interface CredentialManager {
  /**
   * Recursively walk an object and replace all $env.<NAME> strings
   * with the corresponding process.env values.
   * Throws if a referenced env var is not set (strict mode).
   */
  resolve<T>(config: T, options?: ResolveOptions): T;

  /**
   * Validate that all $env references in a config object exist
   * in process.env. Returns list of missing keys.
   * Called once at startup / session init.
   */
  validate(config: any): string[];  // returns missing keys

  /**
   * Register allowed env var names. Only registered names can be
   * resolved (security gate).
   */
  allowlist(keys: string[]): void;
}

interface ResolveOptions {
  strict?: boolean;    // Default: true — throw on missing var
  allowlist?: boolean; // Default: true — check against allowlist
}
```

---

## Security Guarantees

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Security Guarantees                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ✓ Model NEVER receives resolved credential values                        │
│  ✓ $env references are resolved only at tools/call execution time         │
│  ✓ Resolved values scoped to the request — never persisted                │
│  ✓ Resolved values never appear in logs, traces, or telemetry            │
│  ✓ Config validation at startup catches missing env vars early            │
│  ✓ Allowlist restricts which env vars are accessible                      │
│  ✓ Strict mode (default) prevents silent failures                         │
│                                                                           │
│  ✗ Model does not know what credentials it has access to                  │
│  ✗ Transport never stores credentials beyond single request               │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Without vs With Credential Manager

```
Without Credential Manager:

  User config:   { api_key: "sk-1234..." }   ← Plaintext in config!
       │
       ▼
  Agent config:  { api_key: "sk-1234..." }   ← Stored in memory
       │
       ▼
  Tool schema:   api_key: string              ← Model sees value!
       │
       ▼
  Tool call:     api_key leaked in trace      ← Security risk

With Credential Manager:

  User config:   { api_key: "$env.API_KEY" }  ← Env reference
       │
       ▼
  Agent config:  { api_key: "$env.API_KEY" }  ← Reference stored
       │
       ▼
  Tool schema:   api_key: string              ← Model sees reference only
       │
       ▼
  Tool call:     CredentialManager resolves   ← Real value injected
                  ↓                            at execution boundary
                 Real value → API (never stored)
```

---

## Entry Points & Exports

+--------------------------+------------------------------------------------+--------------------------------------------+
| Export                   | Source                                         | Type                                       |
+--------------------------+------------------------------------------------+--------------------------------------------+
| `CredentialManager`      | `infrastructure/credentials/manager.ts`         | Singleton resolver                         |
| `CredentialMapping`      | `infrastructure/credentials/types.ts`           | Mapping interface                          |
+--------------------------+------------------------------------------------+--------------------------------------------+

---

## Dependencies

+----------------------+--------------------------------------------------------------+
| Dependency           | Purpose                                                      |
+----------------------+--------------------------------------------------------------+
| `dotenv`             | Load `.env` file into `process.env` if present               |
| `shared/utils/logger`| Log validation warnings (never log resolved values)           |
+----------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+------------------------------------------+------------------------------------------+
| Ref                        | File (planned)                            | Key Lines                                |
+----------------------------+------------------------------------------+------------------------------------------+
| resolve()                  | `infrastructure/credentials/manager.ts`    | Walk object, replace $env refs           |
| validate()                 | `infrastructure/credentials/manager.ts`    | Check all $env refs exist in env         |
| allowlist()                | `infrastructure/credentials/manager.ts`    | Gate allowed env var names               |
| Regex pattern              | `infrastructure/credentials/manager.ts`    | `/\$env\.([A-Z_][A-Z0-9_]*)/g`          |
+----------------------------+------------------------------------------+------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
