===============================================================================
  State & Session Layer
===============================================================================
  Module    : State & Session
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Overview

State persistence and session management patterns. Zero dependencies on
execution or providers-tools layers.

## Documents

| File                      | Description                                      |
|---------------------------|--------------------------------------------------|
| storage-pattern.md        | State persistence with in-memory/backend storage  |
| session-config.md         | All configurable parameters per session,         |
|                           | Zod schema, parameter table, example JSON        |
| session-management.md     | Go Backend as Session Authority, session CRUD,   |
|                           | turn lifecycle, commit policy, delegated pruning |
| agent-status-protocol.md  | Live agent state visibility — stalled, looping,  |
|                           | degraded detection with frontend components      |

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
