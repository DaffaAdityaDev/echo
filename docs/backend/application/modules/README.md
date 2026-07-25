================================================================================
  MODULES — CROSS-SERVICE MODULE INDEX
================================================================================
  Module    : Modules
  Service   : Backend / Application / Modules
  Version   : 1.0
  Updated   : 2026-07-25
================================================================================

## Overview

Cross-service product modules owned by the backend. The backend acts as
Manager & Auditor — it holds state, enforces security, manages prompt
versions, records audit logs. The Agent is a stateless worker that receives
prompts + config and emits events.

```
BACKEND (Manager / Auditor)          AGENT (Stateless Worker)
  • Database & State                   • Receive prompt + config
  • Prompt versioning                  • Execute ReAct / NLAH loop
  • Auth / Security / Tier             • Call tools & skills
  • Audit logging                      • Emit telemetry events
  • Eval & scoring
```

## Module Index

+----------------------------+---------------------------------------------------+
| Module                     | Description                                       |
+----------------------------+---------------------------------------------------+
| llmops-user-studio.md      | User-facing LLMOps: Playground, Eval Suite,       |
|                            |   Shadow Testing, Governance (new module)         |
+----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
