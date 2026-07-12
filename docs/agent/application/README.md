================================================================================
  Application Layer Documentation
================================================================================
  Module    : Application Layer
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10 (v2 — separated features/ from patterns/)
================================================================================

## Overview

The application layer contains:
- **Features** — what the agent does (API endpoints, external connections,
  execution engine, providers, session management, behavior)
- **Patterns** — how we write code (naming conventions, auth patterns,
  code style, architectural conventions)

---

## Directory Structure

```
application/
├── features/     ← Feature documentation (domain modules)
├── patterns/     ← Code patterns & conventions
└── README.md     ← This file
```

---

## Features

| Directory       | Description                                            |
|-----------------|--------------------------------------------------------|
| (root)          | API endpoint docs (missions, models, features)         |
| adapter/        | Unified external connection layer                      |
| execution/      | Core agent execution loop (harness, strategy, etc.)    |
| providers-tools/| LLM provider interfaces & tool registry                |
| state-session/  | State persistence & session management                 |
| behavior/       | Skills & shared utilities                              |

See [`features/README.md`](features/README.md) for the full index.

---

## Patterns

| Directory       | Description                                            |
|-----------------|--------------------------------------------------------|
| auth/           | Authentication & authorization patterns                |
| code-conventions/ | Naming, file structure, constants style (planned)    |

See [`patterns/README.md`](patterns/README.md) for the full index.

---

## Relationship

Patterns describe **how** we write code (conventions, practices).
Features describe **what** the code does (domain modules, behavior).
The same module may have both a feature doc (explaining its design)
and a patterns doc (explaining its coding conventions).

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
