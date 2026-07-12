================================================================================
  DOMAIN GLOSSARY
================================================================================
  Module    : Domain Glossary
  Service   : Shared / Domain
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Alphabetical definitions of all Echo domain terminology — entities, services,
patterns, and infrastructure components.

## File Structure

Terms reference definitions across these source files:

+------------------------------------+------------------------------------------+
| Location                           | Role                                     |
+------------------------------------+------------------------------------------+
| backend/internal/handler/          |                                          |
|   chat_handler.go                  | ChatHandler, ChatRequest, Feature, Tier  |
|   auth_handler.go                  | AuthHandler, JWT                         |
| backend/internal/middleware/       |                                          |
|   auth.go                          | AuthRequired                             |
| backend/internal/models/models.go  | User, ProviderType, Config, ModelInfo    |
| backend/internal/service/          |                                          |
|   model_service.go                 | ModelService, ProviderConfig             |
|   auth_service.go                  | AuthService                              |
| backend/internal/observability/    |                                          |
|   tracer.go                        | Tracer, Span                             |
| backend/internal/constants/        |                                          |
|   routes/v1.go                     | Route paths                              |
|   auth/jwt.go                      | Auth constants                           |
|   db/postgres.go                   | DB queries                               |
| agent/src/index.ts                 | Hono app entry                           |
| agent/src/shared/types/index.ts    | All shared types                         |
| agent/src/shared/constants/        |                                          |
|   errors.ts                        | Error types                              |
|   middleware.ts                    | Auth constants                           |
| agent/src/app/api/missions/        |                                          |
|   mission.schema.ts                | Zod schema                               |
|   mission.controller.ts            | MissionController                        |
|   stream.transport.ts              | HttpStreamTransport                      |
|   mission.constants.ts             | Mission constants                        |
| agent/src/app/middleware/auth.ts   | Auth middleware                           |
| agent/src/core/agent/harness/      |                                          |
|   cancel_manager.ts                | CancellationManager                      |
| agent/src/core/agent/strategies/   |                                          |
|   prompts.ts                       | Prompt templates                         |
| agent/src/core/agent/tools/        |                                          |
|   registry.ts                      | toolRegistry                             |
| agent/src/core/agent/anchors/      |                                          |
|   factory.ts                       | AnchorFactory                            |
| agent/src/infrastructure/          |                                          |
|   providers/factory.ts             | ProviderFactory                          |
| agent/src/config/                  |                                          |
|   env.schema.ts                    | Env schema                               |
| agent/src/utils/                   |                                          |
|   telemetry.ts                     | OTel SDK                                 |
|   langfuse.ts                      | Langfuse tracing                         |
| frontend/web/src/features/chat/    |                                          |
|   types/index.ts                   | Frontend types                           |
|   api/useChatStream.ts             | Chat stream hook                         |
|   api/useFeatures.ts               | Features hook                            |
| frontend/web/src/features/auth/    |                                          |
|   services/auth-api.ts             | Auth API                                 |
|   hooks/useAuth.ts                 | Auth hook                                |
| frontend/web/src/lib/              |                                          |
|   api-client.ts                    | API client                               |
+------------------------------------+------------------------------------------+

## Glossary

### A

**Agent**
The Hono/Bun TypeScript service (`agent/`) that runs AI mission execution.
Receives requests from Go Gateway, runs strategies (ReAct/NLAH/Standard),
interacts with LLM providers, and streams results via SSE.
*Source: `agent/src/index.ts`*

**AgentHarness**
The core execution engine that orchestrates a mission run. Takes a provider,
strategy, and tools, then runs the agent loop (observe -> think -> act ->
repeat). Emits typed packets during execution.
*Source: `agent/src/core/agent/harness/`*

**AgentPacketType**
Union type defining all SSE event kinds: `metadata`, `reasoning`, `content`,
`tool_call`, `tool_result`, `error`, `checkpoint`, `usage`, `todo`,
`subagent_call`, `subagent_result`, `swarm_status`, `debug`.
*Source: `agent/src/shared/types/index.ts:17-30`*

**AgentState**
Internal mutable state of an agent mission: objective, tasks, memory, message
history.
*Source: `agent/src/shared/types/index.ts:99-106`*

**AgentStrategy**
Interface for constructing the system prompt. Implementations: ReAct
(tool-calling), Standard (direct chat), Sequential
(ordered steps).
*Source: `agent/src/shared/types/index.ts:119-122`*

**AnchorFactory**
Creates the initial system message/anchor for agent state. Provides the base
persona prompt that starts every mission.
*Source: `agent/src/core/agent/anchors/factory.ts`*

**Answer**
A user's submitted response to a flash card. Evaluated by LLM with rubric:
correctness 40%, depth 30%, clarity 30%. Score 0-100.
*Source: `docs/architecture-plan.md:98`*

### B

**BaseMessage**
LangChain Core message type used for conversation history. Wraps HumanMessage,
AIMessage, SystemMessage for LLM provider compatibility.
*Source: `@langchain/core/messages`*

**Bridge Contract**
The typed HTTP contract between Go Gateway and Hono Agent. Defined by Zod
schema on the agent side and Go structs on the gateway side. Authenticated via
`X-Internal-Token`.
*Source: `agent/src/app/api/missions/mission.schema.ts`*

### C

**CancellationManager**
Singleton managing mission abort signals. Registers an AbortController per
missionId. On client disconnect, aborts the signal which the harness checks
between packets.
*Source: `agent/src/core/agent/harness/cancel_manager.ts`*

**Card**
A flash card in the spaced-repetition system. Contains question, answer, SM-2
algorithm fields (EF, interval, due, repetitions, last_score).
*Source: `docs/architecture-plan.md:97`*

**ChatHandler**
Go Fiber handler managing chat requests. Validates input, checks tier gating on
features, resolves model config, proxies SSE stream from Agent.
*Source: `backend/internal/handler/chat_handler.go`*

**Chroma**
Open-source vector database used by agent for RAG (Retrieval Augmented
Generation). Stores embeddings of topics/content for semantic search.
*Source: agent `CHROMA_URL` env config*

### D

**DAG (Directed Acyclic Graph)**
Graph structure for skill prerequisites. `skill_nodes` represent individual
skills, `skill_edges` represent prerequisite relationships. Stored normalized
in relational tables + JSONB cache in `goals.skill_tree`.
*Source: `docs/architecture-plan.md:21-22`*

### E

**Echo**
The overall platform name. Stands for "Enterprise Cutting-edge Hybrid
Orchestrator" — a modular, enterprise-grade playground for AI orchestration and
game server management.

### F

**Feature**
A discoverable capability/plugin that can be bound to a mission. Examples:
`web_search`, `code_execute`. Features have tier requirements
(free vs pro) and are lazily loaded by the tool registry.
*Source: `backend/internal/handler/chat_handler.go:54-59`*

**Frontend**
The Next.js web application (`frontend/web/`) that provides the user interface.
Consumes Go Gateway API. Uses React Query for data fetching, SSE for streaming
chat.
*Source: `frontend/web/src/`*

### G

**Go Gateway**
The Fiber-based Go backend service (`backend/`) acting as API gateway. Handles
authentication, model resolution, tier gating, and SSE proxying to the agent.
*Source: `backend/cmd/server/main.go`*

**Goal**
A high-level user aspiration (e.g., "Become a distributed systems engineer in 6
months") that the system decomposes into a skill DAG (milestones).
*Source: `docs/architecture-plan.md:94`*

### H

**HaaS (Harness as a Service)**
Architecture pattern where the Go Gateway frontends all client requests and the
Hono Agent Engine executes missions as a headless compute layer.
*Source: `docs/headless-haas-architecture.md`*

**HarnessPacket**
Typed packet emitted during mission execution. Contains type, missionId, step
number, content, tool info, and optional metadata. Streamed via SSE.
*Source: `agent/src/shared/types/index.ts:37-56`*

**Hono**
The TypeScript web framework used for the Agent Engine (`agent/`). Lightweight,
fast, with built-in SSE streaming support.
*Source: `agent/package.json`*

**HttpStreamTransport**
Implements the StreamTransport interface. Enriches packets with seq and
timestamp, writes to Hono's SSE stream instance.
*Source: `agent/src/app/api/missions/stream.transport.ts`*

### I

**INTERNAL_AUTH_TOKEN**
Shared secret between Go Gateway and Hono Agent for service-to-service
authentication. Must match in both environments.
*Source: `agent/src/config/env.schema.ts:18-20`*

**IStateStore**
Interface for mission state persistence. Implementations: memory (default),
Redis (saas mode).
*Source: `agent/src/shared/types/index.ts:59-63`*

### J

**JWT (JSON Web Token)**
Authentication token issued by Go Gateway on login. Contains sub (user ID), exp
(72h), iat. Signed with HS256. Transmitted via httpOnly cookie `auth_token` or
`Authorization: Bearer` header.
*Source: `backend/internal/handler/auth_handler.go:34-47`*

### L

**LangChain**
The LLM orchestration framework used by the agent. Provides BaseMessage types,
callback handlers, and integrations with providers.
*Source: `agent/package.json`*

**Langfuse**
Open-source LLM observability platform. Agent sends traces via
`LangfuseSpanProcessor` (OTel) and `CallbackHandler` (LangChain).
*Source: `agent/src/utils/langfuse.ts`*

**LLMProvider**
Interface for LLM communication. Single method: `stream()` returning
`AsyncIterable<ProviderEvent>`. Implementations: OpenAI, Anthropic, LM Studio,
OpenCode Go.
*Source: `agent/src/shared/types/index.ts:162-171`*

**LM Studio**
Local LLM inference server. One of the supported provider types. Configured via
`LM_STUDIO_BASE_URL` env var.
*Source: `backend/internal/models/models.go:14`*

### M

**MCP (Model Context Protocol)**
Standard protocol for connecting AI models to backend tools. Tool definitions
follow OpenAI function-calling schema format.
*Source: `docs/requirment_base.md:52-58`*

**Mission**
A single agent execution session. Created by the MissionController, run by the
AgentHarness. Has a unique missionId, strategy type, and bounded toolset.
*Source: `agent/src/app/api/missions/mission.controller.ts`*

**MissionController**
Hono controller handling mission creation. Safe-parses request body with Zod,
creates AgentHarness, manages SSE stream lifecycle.
*Source: `agent/src/app/api/missions/mission.controller.ts`*

**MissionPayload**
Typed input for a mission: missionId, tenant context, prompt, strategy.
*Source: `agent/src/shared/types/index.ts:10-15`*

**ModelService**
Go interface for LLM model management. Lists available models from configured
providers, resolves model IDs to provider configurations.
*Source: `backend/internal/service/model_service.go`*

### N

**NLAH (Natural-Language Agent Harness)**
Internal agent execution harness that powers the Iterative Agent mode. Not a user-facing mode — `mode: "agent"` internally maps to NLAH strategy.
*Source: `agent/src/core/agent/strategies/prompts.ts:26-70`*

**NUQ (Notified Unified Queue)**
PostgreSQL-based job queue system for web scraping pipeline. Uses pg_cron for
maintenance, listen/notify for worker communication.
*Source: `backend/scripts/init-nuq.sql`*

### O

**Observation**
Standardized response from any tool execution. Contains status
(success/warning/error), summary, data, artifacts, error details.
*Source: `agent/src/shared/types/index.ts:76-82`*

**OpenCode Go**
Third-party LLM provider. Models prefixed with `opencode-go/`. Resolves to
`https://opencode.ai/zen/go/v1` API.
*Source: `backend/internal/service/model_service.go:16,112`*

**OTel (OpenTelemetry)**
Observability framework used for distributed tracing. W3C trace context
propagated via `traceparent` header across all services.
*Source: `backend/internal/observability/tracer.go`,
`agent/src/utils/telemetry.ts`*

### P

**pgvector**
PostgreSQL extension for vector similarity search. Used by `tool_catalog` table
with HNSW index on 384-dimension embeddings.
*Source: `backend/scripts/init-pgvector.sql`*

**Prefix-Caching**
Prompt optimization technique: static instructions first (cache hit), then
sorted tool definitions (partial hit), then dynamic objective at end (always
fresh). Maximizes LLM KV cache utilization.
*Source: `docs/headless-haas-architecture.md:57-84`*

**ProviderConfig**
Configuration for an LLM provider: type, base_url, api_key, model. Resolved by
ModelService and forwarded to agent in payload.
*Source: `backend/internal/models/models.go:18-23`*

**ProviderEvent**
A single event from an LLM stream. Can carry content, reasoning tokens, tool
calls, or usage stats.
*Source: `agent/src/shared/types/index.ts:139-156`*

**ProviderFactory**
Factory function that creates the appropriate LLMProvider implementation based
on provider type string.
*Source: `agent/src/infrastructure/providers/factory.ts`*

### R

**ReAct**
Strategy pattern: Reason + Act loop. Agent thinks step-by-step, calls tools,
and produces final answer. Max 2 sentences per thought. No fluff.
*Source: `agent/src/core/agent/strategies/prompts.ts:5-24`*

**Redis**
In-memory data store used for: feature catalog cache (10m TTL), mission state
storage (saas mode), Pub/Sub for mission log streaming (saas mode).
*Source: `backend/internal/handler/chat_handler.go:343-393`*

### S

**SkillEdge**
Prerequisite relationship between two skill nodes. Links parent_node_id ->
child_node_id in the skill DAG.
*Source: `docs/architecture-plan.md:96`*

**SkillNode**
A single skill/milestone in the goal decomposition DAG. Has name, difficulty,
estimated hours.
*Source: `docs/architecture-plan.md:95`*

**SM-2**
Spaced repetition algorithm for flash cards. Uses Easiness Factor (EF),
interval, and repetition count to schedule reviews.
*Source: `docs/architecture-plan.md:97,243`*

**SSE (Server-Sent Events)**
Streaming protocol for real-time data from server to client. Used for agent
mission output, mission logs. Lines formatted as `data: {json}\n\n`.
*Source: `backend/internal/handler/chat_handler.go:206-211`*

**Standard**
Simple direct-chat strategy. Agent answers user query directly without
tool-calling or sub-agents.
*Source: `agent/src/core/agent/strategies/prompts.ts:2-3`*

**State Backend**
Storage backend for agent mission state. Options: `memory` (default, for
development), `redis` (for saas/production).
*Source: `agent/src/config/env.schema.ts:13`*

**StreamPacket**
Frontend TypeScript type for SSE stream data. Maps AgentPacketType to
renderable content with step tracking.
*Source: `frontend/web/src/features/chat/types/index.ts:62-95`*

**StrategyFactory**
Creates strategy instances by name. Maps strategy strings to concrete
AgentStrategy implementations.
*Source: `agent/src/core/agent/strategies/factory.ts`*

### T

**TenantContext**
Multi-tenancy identifier: tenantId (account partition), userId (user identity),
orgId (billing organization). Default: `local`.
*Source: `agent/src/shared/types/index.ts:4-8`*

**Tier**
Access level for feature gating. Values: `free` (basic features), `pro` (all
features). Passed via `X-User-Tier` header.
*Source: `backend/internal/handler/chat_handler.go:111-114`*

**ToolDefinition**
Contract for a callable tool: name, description, Zod schema, execute function,
keywords.
*Source: `agent/src/shared/types/index.ts:127-133`*

**Tool Registry**
Central registry of all available tools. `resolveTools(features)` lazy-loads
only the requested tool modules for bounded isolation.
*Source: `agent/src/core/agent/tools/registry.ts`*

**Topic**
A subject area for study. Has tag, difficulty, estimated hours. Can be
bulk-imported via CSV/Markdown. Auto-split into atomic micro-skills.
*Source: `docs/architecture-plan.md:96`*

**Traceparent**
W3C trace context HTTP header. Format: `00-{traceID}-{spanID}-{flags}`.
Propagated across frontend -> Go -> Agent for distributed tracing.
*Source: `backend/internal/handler/chat_handler.go:68-90`*

### U

**User**
Platform user entity. Fields: id, email, password_hash, name, role, created_at,
updated_at.
*Source: `backend/internal/models/models.go:64-72`*

### Z

**Zero Tight Coupling**
Architecture principle: No domain logic depends on a concrete implementation.
Interfaces everywhere (Go services, agent providers, frontend client). Swapping
implementations requires config changes, not code changes.
*Source: `docs/requirment_base.md:38-45`*

**Zod**
TypeScript schema validation library used by the agent. Defines request/response
shapes with runtime parsing. Preprocesses input to normalize camelCase <-> 
snake_case.
*Source: `agent/src/app/api/missions/mission.schema.ts`*

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
