================================================================================
  Features - Dynamic Feature Discovery Endpoint
================================================================================
  Module    : Feature Discovery
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Dynamic feature discovery endpoint that exposes the active tool catalog to API
clients. Clients use this to render available capabilities with tier requirements
and UI schema hints.

---

## File Structure

```
features/
  features.routes.ts   # Route definition (single GET)
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         HTTP GET /features                            │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       features.routes.ts                              │
│                       return c.json(ACTIVE_FEATURES)                  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
          ┌─────────────────────────────────────────────────────┐
          │  ACTIVE_FEATURES (from registry.ts)                 │
          │  [                                                  │
          │    { id, name, description,                          │
          │      tier_requirement, ui_schema }                   │
          │  ]                                                  │
          └─────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+---------------------+-------------------------+-------------------+
| Export              | Source                  | Type              |
+---------------------+-------------------------+-------------------+
| `featuresRouter`    | `features.routes.ts`    | `Hono` router     |
+---------------------+-------------------------+-------------------+

---

## Dependencies

+-------------------+-----------------------------------------------------------+
| Dependency        | Purpose                                                   |
+-------------------+-----------------------------------------------------------+
| `hono`            | HTTP framework                                            |
| `ACTIVE_FEATURES` | Feature catalog array (core/agent/tools/registry.ts)       |
+-------------------+-----------------------------------------------------------+

---

## Source References

+--------------------+-----------------------------+----------------------------------------------+
| Ref                | File                        | Key Lines                                    |
+--------------------+-----------------------------+----------------------------------------------+
| Route              | `features.routes.ts:6-8`    | `router.get("/features", ...)` returns catalog|
| Feature catalog    | `registry.ts:20-24`         | 3 features defined                           |
| `delegate_task`    | `registry.ts:21`            | Tier: pro                                   |
| `web_search`       | `registry.ts:22`            | Tier: free                                  |
| `write_todos`      | `registry.ts:23`            | Tier: free                                  |
+--------------------+-----------------------------+----------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
