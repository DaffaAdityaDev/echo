================================================================================
  Patterns — Code Patterns & Conventions
================================================================================
  Module    : Patterns
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Overview

Code patterns, implementation conventions, and style guides for the agent
service. Unlike feature docs (which describe what a module does), patterns
docs describe **how** we write code — naming conventions, constant style,
error propagation, auth implementation, and architectural patterns.

---

## Structure

```
patterns/
├── auth/               ← Authentication & authorization patterns
├── api-docs/           ← OpenAPI spec authoring & Scalar rendering
├── code-conventions/   ← Naming, file structure, constants style
├── (more as needed)    ← e.g. error-handling, dependency-injection
```

---

## Subdirectory Index

### auth/

Documents covering authentication and authorization patterns used across the
agent service. This includes service-to-service JWT, internal token auth,
and provider API key handling.

Related docs in other layers:
- [`docs/shared/patterns/auth-flow.md`](../../../shared/patterns/auth-flow.md)
  — End-to-end auth flow (user + service)
- [`docs/shared/patterns/service-to-service-auth.md`](../../../shared/patterns/service-to-service-auth.md)
  — Service JWT implementation

### api-docs/

Documents covering the API documentation pattern using Scalar and OpenAPI.

- [`docs-api.md`](docs-api.md) — OpenAPI spec authoring, Scalar rendering,
  spec structure, and differences from the backend's Swaggo approach

### code-conventions/

(Planned) Documents covering:
- File and folder naming conventions
- Constant and environment variable naming
- Import ordering and module structure
- TypeScript type conventions
- Error handling patterns
- Testing conventions

---

## What Belongs in Patterns vs Features

| Criterion | Patterns (`patterns/`) | Features (`features/`) |
|---|---|---|
| Focus | **How** we write code | **What** the code does |
| Audience | Developers writing code | Developers understanding the system |
| Example topics | Naming conventions, auth impl, | Harness architecture, provider |
|  | error propagation, DI pattern | abstraction, session design |
| Changes rarely | Yes — conventions are stable | Yes — feature behavior evolves |
| Cross-service | Often shared patterns | Agent-specific domain docs |

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
