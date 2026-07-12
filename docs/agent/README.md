================================================================================
  Echo Agent Documentation
================================================================================
  Module    : Agent Documentation Root
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Overview

Enterprise-grade documentation for the Echo Agent service. This documentation
covers the application layer (features + patterns), domain model,
infrastructure components, and shared types/utilities that comprise the
agent system.

---

## Directory Structure

+-------------------+--------------------------------------------------------------+
| Directory         | Description                                                  |
+-------------------+--------------------------------------------------------------+
| application/      | Feature docs (what) + code patterns (how)                    |
| domain/           | Tool definitions and prompt engineering                      |
| infrastructure/   | API routes, telemetry, retriever, server entry              |
| shared/           | Type definitions, constants, and utility classes             |
+-------------------+--------------------------------------------------------------+

---

## Documentation Index

### Features (what the code does)

+-----------------------------------------------+------------------------------------------+
| Document                                      | Description                              |
+-----------------------------------------------+------------------------------------------+
| application/features/missions.md              | Mission execution management             |
| application/features/models.md                | LLM model listing endpoint               |
| application/features/features.md              | Dynamic feature discovery                |
| application/features/adapter/adapter-architecture.md | Unified external connection layer |
| application/features/execution/harness-pattern.md | Core agent execution loop            |
| application/features/execution/strategy-pattern.md | Agent execution mode factory        |
| application/features/providers-tools/provider-abstraction.md | LLMProvider interface      |
| application/features/state-session/session-management.md | Session authority design      |
| application/features/behavior/skills-system.md | Behavioral pattern system               |
+-----------------------------------------------+------------------------------------------+

### Patterns (how we write code)

+-----------------------------------------------+------------------------------------------+
| Document                                      | Description                              |
+-----------------------------------------------+------------------------------------------+
| application/patterns/README.md                | Patterns index + conventions             |
+-----------------------------------------------+------------------------------------------+

### Infrastructure & Domain

+--------------------------------+------------------------------------------+
| Document                       | Description                              |
+--------------------------------+------------------------------------------+
| infrastructure/api-routes.md   | Hono REST API route structure            |
| infrastructure/telemetry.md    | OpenTelemetry and Langfuse               |
| infrastructure/server-entry.md | Application entry point                  |
| domain/tool-definitions.md     | Agent tool definitions                   |
| domain/prompt-engineering.md   | Prompt compilation strategy              |
| shared/types.md                | TypeScript type definitions              |
| shared/constants.md            | Shared constants                         |
| shared/utils.md                | Utility classes and functions            |
+--------------------------------+------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
