================================================================================
  Models - LLM Model Listing Endpoint
================================================================================
  Module    : Model Management
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

LLM model listing endpoint that proxies requests to the configured LLM provider
API, transforming responses into a normalized format.

---

## File Structure

```
models/
  model.routes.ts      # Route definition
  model.controller.ts  # Fetch and transform model list
  model.constants.ts   # Path and log message constants
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         HTTP GET /models                              │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          model.routes.ts                              │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    model.controller.listModels(c)                      │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌────────────────────────────────┐  ┌────────────────────────────────────┐
│  Read baseHost from            │  │  On error:                        │
│  ENV.LLM_MODEL_API_URL         │  │  return c.json({ models: [] })    │
│                                │  └────────────────────────────────────┘
│  Build URL: {host}/v1/models   │
│                                │
│  fetch(url)                    │
│                                │
│  Transform response:           │
│  { data: [{ id: "gpt-4" }] }  │
│  → { models: [{id, name}] }   │
│                                │
│  Return c.json({ models })     │
└────────────────────────────────┘
```

---

## Entry Points & Exports

+--------------------+-------------------------+---------------------------+
| Export             | Source                  | Type                      |
+--------------------+-------------------------+---------------------------+
| `modelRouter`      | `model.routes.ts`       | `Hono` router             |
| `modelController`  | `model.controller.ts`   | `ModelController` instance|
| `MODEL_CONSTANTS`  | `model.constants.ts`    | Constants object          |
| `LOG_MESSAGES`     | `model.constants.ts`    | Log message constants     |
+--------------------+-------------------------+---------------------------+

---

## Dependencies

+---------------------------+----------------------------------------------------+
| Dependency                | Purpose                                            |
+---------------------------+----------------------------------------------------+
| `hono`                    | HTTP framework                                     |
| `ENV.LLM_MODEL_API_URL`   | Base URL for LLM provider from environment config   |
| `LLM_API_VERSIONS.V1`     | API version suffix (shared/constants)              |
| `logger`                  | Structured logging                                 |
+---------------------------+----------------------------------------------------+

---

## Source References

+-----------------------+-----------------------------+----------------------------------------------+
| Ref                   | File                        | Key Lines                                    |
+-----------------------+-----------------------------+----------------------------------------------+
| Route                 | `model.routes.ts:6`          | `router.get("/models", ...)`                 |
| Controller fetch      | `model.controller.ts:9-11`  | Builds URL from env + `/v1/models`           |
| Response transform    | `model.controller.ts:19-22` | Maps `result.data` to `{ id, name }`         |
| Error fallback        | `model.controller.ts:25-28` | Returns empty `{ models: [] }` on failure    |
| Constants             | `model.constants.ts`         | `MODELS_PATH: '/models'`                     |
+-----------------------+-----------------------------+----------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
