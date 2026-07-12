================================================================================
  HEADLESS HARNESS AS A SERVICE (HAAS)
================================================================================
  Module    : Headless HaaS
  Service   : Shared / Architecture
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Echo's architecture treats the AI agent engine as a **headless compute layer**
— the Go Fiber gateway (Memory Gateway) frontends all client requests, while
the Hono Agent Engine executes missions in isolation. Clients never talk to the
agent directly. The gateway enforces auth, tier gating, model resolution, and
feature binding before forwarding to the stateless agent.

The agent is **stateless** — it has no direct database access. For memory
operations (episodic, semantic, procedural) it calls back into the backend
via authenticated HTTP using a **Service JWT**. This creates a clean
bidirectional contract: backend → agent for mission execution (user-facing),
agent → backend for memory persistence (internal).

## File Structure

+----------------------------+------------------------------------------------------+
| File / Directory           | Role                                                 |
+----------------------------+------------------------------------------------------+
| frontend/web/              |                                                      |
|   features/chat/           |                                                      |
|     api/                   |                                                      |
|       useChatStream.ts     | Client SSE consumer                                  |
|       useFeatures.ts       | Feature discovery hook                               |
|   auth/hooks/              |                                                      |
|     useAuth.ts             | Auth hook                                            |
| agent/src/                 |                                                      |
|   app/api/missions/        |                                                      |
|     mission.schema.ts      | Zod validation schema                                |
|     mission.controller.ts  | Harness orchestration                                |
|     stream.transport.ts    | SSE packet writer                                    |
|   app/middleware/           |                                                      |
|     auth.ts                | Token validation (shared secret)                     |
|   config/                  |                                                      |
|     env.schema.ts          | Env validation                                       |
|     env.constants.ts       | Env defaults                                         |
|   core/agent/              |                                                      |
|     harness/               |                                                      |
|       cancel_manager.ts    | Abort signal per mission                             |
|     strategies/            |                                                      |
|       prompts.ts           | Prefix-caching prompt templates                      |
|     tools/                 |                                                      |
|       registry.ts          | Lazy tool loading                                    |
    |     adapter/               |                                                      |
    |       backend/             |                                                      |
    |       memory.adapter.ts   | Calls backend via Service JWT for persistence        |
| backend/                   |                                                      |
|   internal/                |                                                      |
|     handler/               |                                                      |
|       chat_handler.go      | SSE proxy, tier check                                |
|       auth_handler.go      | JWT login                                            |
|       memory_handler.go    | Memory endpoint handlers (internal)                  |
|     middleware/             |                                                      |
|       auth.go              | User JWT validation                                  |
|       service_auth.go      | Service JWT validation (internal routes)             |
|     router/                |                                                      |
|       router.go            | Route wiring (public + internal)                     |
|     service/               |                                                      |
|       model_service.go     | Model resolution                                     |
|       memory_service.go    | Memory CRUD (called by internal handler)             |
|     observability/         |                                                      |
|       tracer.go            | OTel tracing                                         |
+----------------------------+------------------------------------------------------+

## ASCII Flow Diagram

┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  ECHO SYSTEM (v2 — Memory Gateway)                                 │
│                                                                                                    │
│  ┌──────────────┐              ┌──────────────────────────┐         ┌──────────────────────────┐  │
│  │  MCP Client  │              │                          │         │                          │  │
│  │  (Claude,    │──── MCP ────►│   Go Fiber Gateway       │         │  Hono Agent Engine       │  │
│  │   Code, IDE) │              │   (Memory Gateway)        │         │  (Stateless Compute)      │  │
│  ├──────────────┤              │                          │         │                          │  │
│  │  REST Client │              │  ┌────────────────────┐  │  POST   │  ┌──────────────────┐   │  │
│  │  (Next.js)   │── REST+SSE ─►│  │ Auth MW            │  │────────┼─►│  Auth MW          │   │  │
│  │              │              │  │ User JWT Valid.     │  │ /api/  │  │  (User JWT /      │   │  │
│  │  End-Users   │              │  └────────┬───────────┘  │ mission│  │   X-Internal-Token)│   │  │
│  └──────────────┘              │           │              │         │  └────────┬─────────┘   │  │
│                                │           ▼              │         │           │             │  │
│                                │  ┌────────────────────┐  │         │           ▼             │  │
│                                │  │ Tier Gate          │  │         │  ┌──────────────────┐   │  │
│                                │  │ (feature binding)  │  │         │  │ Mission Controller│  │  │
│                                │  └────────┬───────────┘  │         │  │ schema.safeParse  │   │  │
│                                │           │              │         │  └────────┬─────────┘   │  │
│                                │           ▼              │         │           │             │  │
│                                │  ┌────────────────────┐  │         │           ▼             │  │
│                                │  │ Model Resolution   │  │         │  ┌──────────────────┐   │  │
│                                │  │ (Provider routing) │  │         │  │ Tool Registry    │   │  │
│                                │  └────────┬───────────┘  │         │  │ resolveTools()   │   │  │
│                                │           │              │         │  └────────┬─────────┘   │  │
│                                │           ▼              │         │           │             │  │
│                                │  ┌────────────────────┐  │  POST   │           ▼             │  │
│                                │  │ Chat Handler       │──┼─────────┼──────►┌──────────────┐  │  │
│                                │  │ SSE Proxy          │◄─┼─────────┼───────│ AgentHarness │  │  │
│                                │  └────────────────────┘  │         │       │ runMission() │  │  │
│                                │                          │         │       └──────┬───────┘  │  │
│                                │  ┌────────────────────┐  │         │          │              │  │
│                                │  │ Service JWT MW     │◄─┼──SVC────┼──────────┼──────────────┼──┤  │
│                                │  │ (Internal Routes)  │  │   JWT   │       ┌──▼──────────┐  │  │
│                                │  └────────────────────┘  │  POST   │       │ Adapter     │──┤  │
│                                │           ▲              │ /api/   │       │ Layer       │  │LLM│
│                                │           │              │  v1/    │       │(llm/backend │◄─┤API│
│                                │           │              │ internal│       │ /mcp)       │  │  │
│                                │           │              │         │       └─────────────┘  │  │
│                                │           │              │         └──────────────────────────┘  │
│                                │           │  POST /api/v1/internal/*                              │
│                                │           │  Auth: Bearer <Service JWT>                           │
│                                │           │                                                        │
│                                │  ┌──────────────────────────────────────────┐                     │
│                                │  │  Memory Endpoints                        │                     │
│                                │  │  - /internal/memory/episodic            │                     │
│                                │  │  - /internal/memory/semantic            │                     │
│                                │  │  - /internal/memory/procedural          │                     │
│                                │  │  - /internal/state/*                    │                     │
│                                │  │  - /internal/config/session             │                     │
│                                │  │                                          │                     │
│                                │  │  Session Endpoints (v2)                  │                     │
│                                │  │  - /internal/sessions/summarize         │                     │
│                                │  │    (Agent → Go: consolidation)          │                     │
│                                │  └──────────────────────────────────────────┘                     │
│                                │                          │                                        │
│                                │  ┌──────────────────────────────────────┐                        │
│                                │  │  PostgreSQL                           │                        │
│                                │  │  ├─ users, models, features           │                        │
│                                │  │  ├─ sessions (id, user, summary)      │  ← New                  │
│                                │  │  ├─ messages (id, session, role,      │  ← New                  │
│                                │  │  │            content, token_count)   │                        │
│                                │  │  ├─ memory_semantic (pgvector)        │                        │
│                                │  │  └─ memory_procedural                 │                        │
│                                │  ├──────────────────────────────────────┤                        │
│                                │  │  Redis Cache                           │                        │
│                                │  │  ├─ features TTL (10m)                │                        │
│                                │  │  └─ episodic memory (24h)             │                        │
│                                │  └──────────────────────────────────────┘                        │
│                                └──────────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

## Headless HaaS Flow (Detailed)

### 1. CLIENT DISCOVERY PHASE

┌────────────┐              ┌──────────────────┐              ┌──────────────────────┐
│  Frontend  │  GET /features│    Go (Fiber)    │  GET /api/   │    Hono Agent        │
│            │──────────────►│                  │  features    │                      │
│            │               │                  │─────────────►│  registry.ts         │
│            │               │   Redis cache    │              │                      │
│            │               │   (10m TTL)     │◄─────────────│  Returns ACTIVE      │
│            │               │                  │              │  FEATURES            │
│            │◄──────────────│  Filtered by tier│              │                      │
│            │  { id, locked}│                  │              │                      │
└────────────┘              └──────────────────┘              └──────────────────────┘

### 2. EXECUTION PHASE (Forward: Backend → Agent)

┌────────────┐              ┌──────────────────┐              ┌──────────────────────┐
│  Frontend  │  POST /chat  │    Go (Fiber)    │  POST /api/   │    Hono Agent        │
│            │  { message,  │                  │  generate-   │                      │
│            │    model,    │                  │  mission     │  MissionCtrl         │
│            │    features, │                  │  { prompt,   │                      │
│            │    mode,     │                  │    features, │  ┌────────────────┐   │
│            │    missionId,│                  │    provider_ │  │ features [] →  │   │
│            │    history } │                  │    config,   │  │ resolveTools() │   │
│            │─────────────►│  Validate        │    history,  │  │ features undef │   │
│            │              │  features vs tier│    missionId }│  │ → skills'pref  │   │
│            │              │                  │─────────────►│  │ neither →      │   │
│            │              │  Resolve model   │              │  │ ToolRetriever  │   │
│            │              │  -> provider     │              │  └────────┬───────┘   │
│            │              │                  │              │           │           │
│            │              │  features ALWAYS │              │           ▼           │
│            │              │  sent (even [])  │              │  ┌──────────────┐    │
│            │              │  → signals "no   │              │  │  Harness     │    │
│            │              │    tools"        │              │  │ runMission() │    │
│            │              │                  │              │  │ explicitTools│    │
│            │              │  Set SSE headers │              │  │ !== undefined│    │
│            │              │                  │              │  │ → use as-is  │    │
│            │              │                  │              │  │ undefined →  │    │
│            │              │                  │              │  │ ToolRetriever│    │
│            │              │                  │              │  └──────┬───────┘    │
│            │              │  Proxy           │   SSE Chunks │         │            │
│            │  SSE Stream  │  w.Write         │◄─────────────│  Packet Stream      │
│            │  { type,     │◄─────────────────│              └──────────────────────┘
│            │    content,  │                  │
│            │    ... }     │                  │
└────────────┘              └──────────────────┘

### 3. MEMORY PERSISTENCE (Reverse: Agent → Backend via Service JWT)

During mission execution, the agent's Memory Plugin calls back into the
backend to persist episodic, semantic, and procedural memory:

┌──────────────────────┐               ┌──────────────────┐
│  Hono Agent          │  POST /api/   │  Go (Fiber)      │
│                      │  v1/internal/ │                  │
│  Memory Plugin       │  memory/*     │  Service JWT MW  │
│  signs Service JWT   │  Auth: Bearer │  validates JWT   │
│  with SHARED_SECRET  │──────────────►│  with same       │
│                      │               │  SHARED_SECRET   │
│                      │               │                  │
│                      │  200/201      │  Writes to       │
│                      │◄──────────────│  PostgreSQL      │
│                      │  { success }  │                  │
└──────────────────────┘               └──────────────────┘

## Explicit Tool-Binding Isolation

Client Request
     │
     ▼
{ message: "...", features: ["web_search", "code_execute"] }
     │
     ▼
Go Gateway: Validate features[] vs user tier
     │  (if free user requests pro feature -> 403)
     │  Features ALWAYS forwarded (even empty [])
     ▼
Hono: schema.safeParse(payload) -> extract features[]
     │  features: []  → explicit "no tools"
     │  features: undefined → skills/ToolRetriever fallback
     ▼
Hono: if features explicitly provided:
     │  registry.resolveTools(features)
     │  skills do NOT add tools
     │  Lazy-loads only requested tool modules:
      │  - web_search.ts      ✓ loaded
      │  - code_execute.ts    ✓ loaded
     │
     ▼
Hono: if features NOT provided:
     │  if skills exist → resolve skills' preferredTools
     │  if no skills → harness uses ToolRetriever
     ▼
Hono: AgentHarness { tools: [web_search, code_execute] }
     │  explicitTools !== undefined → use as-is
     │  explicitTools === undefined → ToolRetriever
     ▼
LLM: Only sees the bounded toolset in system prompt
     │  -> Cannot call unlisted tools
     │  -> Context window saved (fewer tokens)
     │  -> Security boundary enforced
     │
     ▼
Sub-agents inherit same bounded toolset

## Prefix-Caching Prompt Optimization

LLM Request Cache Layout (5-Block Architecture)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ BLOCK 1: GLOBAL SYSTEM INSTRUCTIONS (STATIC — 100% Cache Hit)                             │
│                                                                                           │
│   "You are Echo, an autonomous ReAct executor..."                                         │
│   - Core persona definition                                                               │
│   - ReAct loop reasoning rules                                                            │
│   - SSE JSON streaming contract guidelines                                                │
│   - General constraints                                                                   │
│                                                                                           │
│   KV CACHE: ✓ Reused across ALL users, ALL sessions                                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ BLOCK 2: BOUNDED TOOL DEFINITIONS (Semi-Static — Partial Cache Hit)                       │
│                                                                                           │
│   <available_tools>                                                                       │
│   - code_execute: { name, description, parameters }     (alphabetically sorted)           │
│   - web_search:   { name, description, parameters }     (alphabetically sorted)           │
│   </available_tools>                                                                      │
│                                                                                           │
│   KV CACHE: ✓ Hit when same toolset was used previously                                  │
│             ✗ Miss when features[] differ from cache prefix                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ BLOCK 3: TOPIC ADDITIONS (Semi-Static — Cache Hit per Topic)                              │
│                                                                                           │
│   [kubernetes-specific system instructions]                                               │
│   [hard consolidation summary from pruned history]                                        │
│                                                                                           │
│   Injected by ContextResolver (see `docs/agent/application/features/                      │
│   execution/context-resolver-pattern.md`).                                                 │
│                                                                                           │
│   KV CACHE: ✓ Hit when same topic across turns                                           │
│             ✗ Miss when topic switches between requests                                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ BLOCK 4: ACCUMULATED CHAT HISTORY (Append-Only Dynamic — Incremental Cache Hit)           │
│                                                                                           │
│   messages[1]: anchor (system)                                                            │
│   messages[2]: turn 1 (Human + Assistant)                                                 │
│   messages[3]: turn 2 (Human + Assistant)                                                 │
│   ...                                                                                     │
│   messages[N]: turn N-1 (Human + Assistant)                                               │
│                                                                                           │
│   KV CACHE: ✓ Previous turns remain cached (prefix unchanged)                            │
│             ✓ Only the newly appended turn incurs a computational miss                    │
│             ✗ History pruning (shift) causes full cache invalidation — see               │
│               "History Pruning Trap" below                                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ BLOCK 5: VOLATILE DYNAMIC TAIL (Always Fresh — Known Cache Miss)                          │
│                                                                                           │
│   <context>                                                                               │
│   Current Knowledge Fragments (RAG for this turn)                                         │
│   </context>                                                                              │
│                                                                                           │
│   <objective>                                                                             │
│   What is the capital of France?                                                          │
│   </objective>                                                                            │
│                                                                                           │
│   KV CACHE: ✗ Always computed fresh (unique per query + RAG)                             │
│             ✗ Does NOT invalidate preceding BLOCK 1-4 cache                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Behavior by Turn Sequence

```
Turn 1:
  BLOCK 1-3: cold (first request) or warm (earlier session)
  BLOCK 4: empty or anchor only
  BLOCK 5: fresh — miss
  → 1 miss (BLOCK 5)

Turn 2 (same topic, same tools):
  BLOCK 1-3: HIT ✓ (identical prefix)
  BLOCK 4: HIT for messages[1..N] — only new appended turn computed
  BLOCK 5: fresh — miss
  → incremental cost: one new turn history + BLOCK 5 only

Turn 3 (topic changes):
  BLOCK 1: HIT ✓ (static)
  BLOCK 2: HIT/MISS depending on tool combo change
  BLOCK 3: MISS (topic additions change)
  BLOCK 4: HIT for history (prefix unchanged)
  BLOCK 5: fresh — miss
  → cost: BLOCK 3 miss on topic switch — acceptable
```

### History Pruning Trap & Hard Consolidation

When chat history exceeds the context window, a naive FIFO shift (removing
`messages[1]`) destroys the KV cache for ALL remaining history because every
subsequent token position shifts:

```
Naive FIFO (100% cache miss):
  [anchor][turn1][turn2][turn3]
  → remove turn1
  [anchor]     [turn2][turn3] ← all shifted → full miss
```

Solution — **Hard Consolidation**: summarize oldest turns into a static
block appended to BLOCK 3, removing them from BLOCK 4:

```
Hard Consolidation (1 controlled miss):
  1. Summarize turn1-3 → "User asked about deployment..."
  2. Append to BLOCK 3 (messages[0].content += summary)
  3. Remove turn1-3 from messages[]
  4. Accept 1 miss on BLOCK 3
  5. BLOCK 4 (remaining history) stays INTACT → cache HIT
```

### Provider-Specific Cache Alignment

Different LLM providers handle prompt caching differently. The harness
must detect the provider and align breakpoints accordingly:

```
DeepSeek / OpenAI:
  - Automatic prefix caching
  - Granularity: 1024-token boundaries (OpenAI)
  - No explicit flags needed
  - Strategy: ensure total prompt length stays above provider minimum
    for automatic cache eligibility

Anthropic (Claude):
  - REQUIRES explicit cache_control: {"type": "ephemeral"}
  - Maximum 4 breakpoints per request
  - Recommended breakpoint placement:
    1. End of BLOCK 1 (Global System)           ← checkpoint 1
    2. End of BLOCK 2 (Tool Definitions)         ← checkpoint 2
    3. End of BLOCK 3 (Topic Additions)          ← checkpoint 3
    4. End of BLOCK 4 (Latest History Turn)      ← checkpoint 4 (NOT at RAG)
  - DO NOT waste breakpoints on BLOCK 5 (Volatile Tail) — it changes every turn

  Example Anthropic request:
    system: [
      { text: "You are Echo...", cache_control: { type: "ephemeral" } },
      { text: "<tools>...</tools>" },
      { text: "[k8s instructions]" },
    ]
    messages: [
      // BLOCK 4 history...
      { role: "user", content: "<context>RAG data</context>\n\nUser query" }
    ]
```

### KV Cache Rules

```
1. Tools MUST be sorted alphabetically before serialization
   → Identical features[] produce identical string → cache hit

2. BLOCK 3 (Topic Additions) injected into anchor (messages[0])
   → NOT a separate message — keeps BLOCK 4 (History) contiguous

3. Knowledge fragments (RAG) placed at absolute tail (BLOCK 5)
   → Combined with current query as a single HumanMessage
   → Does NOT invalidate BLOCK 1-4 prefix cache

4. BLOCK 4 (History) is append-only
   → Do NOT mutate, splice, or reorder historical messages
   → If pruning needed: Hard Consolidation (see above)

5. Provider-specific breakpoints set at harness layer
   → HarnessAdapter detects provider from LLMProvider type
   → Applies correct cache_control flags per provider spec
```

## SSE Streaming Architecture (Dual Mode)

                   SaaS Mode (Redis Pub/Sub)
                   ──────────────────────────
                   Hono pushes -> Redis PUB "stream:{missionId}"
                                       │
                   Go subscribes ◄─────┘
                   -> forwards SSE to client

                   Local Mode (Reverse Proxy)
                   ──────────────────────────
                   Hono in-memory SSE stream
                       │
                   Go GET /api/v1/missions/{id}/stream
                       │  bufio copy
                   -> forwards SSE to client

## Entry Points & Exports

- **Go Gateway**: `backend/cmd/server/main.go` -> `router.SetupRoutes()`
- **Agent Engine**: `agent/src/index.ts` -> Hono app
- **Frontend**: `frontend/web/src/app/page.tsx` -> `useChatStream()`

## Dependencies

- **Go**: `fiber/v3` (HTTP), `pgx/v5` (PostgreSQL), `go-redis/v9`,
  `golang-jwt/v5` (User + Service JWT), `otel/OTLP`
- **Agent**: `hono` (HTTP), `zod` (validation), `langchain` (LLM), `bun` (runtime),
  `jsonwebtoken` (Service JWT signing)
- **Frontend**: `next.js`, `@tanstack/react-query`, `zod`

## Source References

+-------------------------------------------------------+--------------------------------------+
| File                                                  | Role                                 |
+-------------------------------------------------------+--------------------------------------+
| backend/internal/handler/chat_handler.go              | SSE proxy, tier gating, feature      |
|                                                       |   caching                            |
| backend/internal/handler/memory_handler.go            | Internal memory endpoints            |
| backend/internal/middleware/auth.go                   | User JWT validation                  |
| backend/internal/middleware/service_auth.go           | Service JWT validation               |
| backend/internal/router/router.go                     | Route wiring (public + internal)     |
| agent/src/app/api/missions/mission.controller.ts      | Harness orchestration                |
| agent/src/app/api/missions/mission.schema.ts          | Zod validation schema                |
| agent/src/app/api/missions/stream.transport.ts        | SSE packet writer                    |
| agent/src/core/agent/tools/registry.ts                | Lazy tool loading                    |
| agent/src/core/agent/strategies/prompts.ts            | Prefix-caching prompt templates      |
| agent/src/adapter/backend/memory.adapter.ts          | Memory persistence via Service JWT   |
| agent/src/shared/types/index.ts                       | Cross-service type contracts         |
| frontend/web/src/features/chat/api/useChatStream.ts   | Client SSE consumer                  |
+-------------------------------------------------------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
