================================================================================
  Application Layer - Features & Architectural Patterns
================================================================================
  Module    : Application Layer
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

The Application layer implements use cases and orchestrates domain logic.
It is composed of business features and architectural patterns that govern
code organization.

Directory Structure
-------------------

+----------------------+------------------------------------------------------------+
| Directory            | Description                                                |
+----------------------+------------------------------------------------------------+
| features/            | Business feature implementations: auth, chat, models       |
| patterns/            | Architectural patterns: repository, service, handler, mw   |
+----------------------+------------------------------------------------------------+

Features
--------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| features/auth.md                         | Authentication & Authorization with JWT             |
| features/chat-streaming.md               | SSE relay, agent communication, streaming modes    |
| features/model-management.md             | Provider-agnostic model resolution and caching     |
+------------------------------------------+----------------------------------------------------+

Patterns
--------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| patterns/repository-pattern.md           | Data access abstraction with pgx                    |
| patterns/service-layer.md                | Business logic decoupling from HTTP                 |
| patterns/handler-pattern.md              | Thin HTTP layer for request/response processing     |
| patterns/middleware-chain.md             | Request pipeline: recovery, logging, CORS, JWT     |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
