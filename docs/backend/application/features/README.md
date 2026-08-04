================================================================================
  Features - Business Feature Implementations
================================================================================
  Module    : Features
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-31 (planned: strategy lifecycle integration)
================================================================================

This directory documents the business feature implementations of the Echo
backend service.

Documentation Index
-------------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| auth.md                                  | JWT authentication, registration stub, login flow, |
|                                          | token signing, cookie management, middleware        |
| chat-streaming.md                        | SSE streaming relay, agent communication, two      |
|                                          | modes (local/SaaS), mission log streaming,         |
| strategy/                                | Strategy catalog, 3-step resolution order,         |
|                                          | resolution [Active]                                |
| worker/                                  | Background lifecycle worker (consolidation, decay, |
|                                          | rollout cache — in-process goroutine [Active]      |
| model-management.md                      | Provider-agnostic model listing and resolution,    |
|                                          | caching with double-checked locking, fallback      |
|                                          | chain across OpenAI, Anthropic, LM Studio, OpenCode|
| governance.md                            | Roles, RBAC, governance & change management        |
| playground.md                            | LLMOps playground (multi-model comparison)         |
| lifecycle worker (in server-lifecycle.md)| Background consolidation, decay/GC, strategy       |
|                                          | rollout cache — in-process goroutine [Active]      |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
