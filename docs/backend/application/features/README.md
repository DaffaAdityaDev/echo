================================================================================
  Features - Business Feature Implementations
================================================================================
  Module    : Features
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
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
|                                          | feature catalog caching                            |
| model-management.md                      | Provider-agnostic model listing and resolution,    |
|                                          | caching with double-checked locking, fallback      |
|                                          | chain across OpenAI, Anthropic, LM Studio, OpenCode|
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
