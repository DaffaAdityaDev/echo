================================================================================
  MODELS DATA FLOW
================================================================================
  Module    : Models Data Flow
  Service   : Shared / Domain
  Version   : 1.2
  Updated   : 2026-08-07 (chat request trimmed to {message, sessionId}; X-Session-ID response header)
================================================================================

## Description

ASCII sequence diagrams showing how each domain entity (User, Goal, SkillNode,
SkillEdge, Topic, Card, Mission, Answer) flows across services: frontend ->
backend -> agent -> database.

## File Structure

+-----------------------------+---------------------------------------------+
| Location                    | Role                                        |
+-----------------------------+---------------------------------------------+
| backend/internal/models/    |                                             |
|   models.go                 | User, Config struct definitions             |
| backend/internal/handler/   |                                             |
|   chat/handler.go           | Chat handler                                |
| backend/internal/service/   |                                             |
|   aimodel/service.go        | Model service interface                     |
| backend/internal/repository/|                                             |
|   auth/repository.go        | User repository interface                   |
| backend/internal/router/    |                                             |
|   router.go                 | Route wiring                                |
| agent/src/shared/types/     |                                             |
|   index.ts                  | MissionPayload, HarnessPacket, etc.         |
| agent/src/core/agent/       |                                             |
|   strategies/prompts.ts      | Prompt templates                            |
| frontend/web/src/features/              |                                             |
|   chat/hooks/useChatStream.ts | Chat stream hook                           |
+-----------------------------+---------------------------------------------+

## User

```
┌──────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   FRONTEND   │            │   GO BACKEND     │            │   POSTGRESQL     │
└──────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
       │                            │                               │
       │  POST /auth/register       │                               │
       │  { email, password,        │                               │
       │    name }                  │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  Hash password                │
       │                            │  INSERT INTO users            │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  RETURNING id, created_at     │
       │                            │◄──────────────────────────────│
       │                            │                               │
       │                            │  (currently 501               │
       │                            │   Not Implemented)            │
       │                            │                               │
       │  POST /auth/login          │                               │
       │  { username }              │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  Mock auth: userID = "1"      │
       │                            │                               │
       │                            │  Create JWT claims:           │
       │                            │   sub: "1", exp: 72h         │
       │                            │                               │
       │                            │  Sign with JWT_SECRET         │
       │                            │                               │
       │  { token, user }           │                               │
       │◄───────────────────────────│                               │
       │                            │                               │
```

**Fields**: id, email, password_hash, name, role, created_at, updated_at
**Service**: Go Backend only. No agent involvement.
**Storage**: PostgreSQL `users` table.

> **Status:** The Goal, SkillNode/SkillEdge, Topic, Card, Mission, and Answer
> entities described below are **PLANNED** — they have no corresponding database
> tables, handlers, or services in the current codebase. Sequence diagrams show
> the intended architecture for future implementation.

## Goal

```
┌──────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   FRONTEND   │            │   GO BACKEND     │            │   POSTGRESQL     │
└──────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
       │                            │                               │
       │  POST /goal                │  (PLANNED)                    │
       │  { title: "Distributed     │                               │
       │    Systems Engineer        │                               │
       │    in 6 months" }          │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  INSERT INTO goals            │
       │                            │  (user_id, title, desc)       │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  Auto-generate skill DAG      │
       │                            │  INSERT skill_nodes           │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  INSERT skill_edges           │
       │                            │  (prerequisites)              │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  Cache JSONB in               │
       │                            │  goals.skill_tree             │
       │                            │──────────────────────────────►│
       │                            │                               │
       │  { skill_tree JSON }       │                               │
       │◄───────────────────────────│                               │
       │                            │                               │
```

**Fields**: id, user_id, title, description, target_date, skill_tree (JSONB),
created_at
**Service**: Go Backend. Agent may enhance with LLM-based splitting (planned).
**Storage**: PostgreSQL `goals` table + `skill_nodes` + `skill_edges`.

## SkillNode & SkillEdge (DAG)

                    MILESTONE DAG (Directed Acyclic Graph)
                    ─────────────────────────────────────

                          ┌──────────────────────────┐
                          │      SkillNode A         │
                          │     "Go Basics"          │
                          └────────────┬─────────────┘
                                       │  prerequisite
                                       ▼
                          ┌──────────────────────────┐
                     ┌───►│      SkillNode B         │◄────┐
                     │    │    "HTTP Servers"         │     │
                     │    └────────────┬─────────────┘     │
                     │                 │                   │
              prerequisite       prerequisite       prerequisite
                     │                 │                   │
                     │                 ▼                   │
                     │    ┌──────────────────────────┐     │
                     │    │      SkillNode C         │─────┘
                     └────│    "gRPC Clients"        │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │      SkillNode D         │
                          │   "Distributed Systems"  │
                          └──────────────────────────┘

skill_nodes table:                   skill_edges table:
┌────┬──────────────┬────────┐      ┌────┬────────────┬──────────────┐
│ id │ name         │ goal_id│      │ id │ parent_id  │ child_id     │
├────┼──────────────┼────────┤      ├────┼────────────┼──────────────┤
│ 1  │ Go Basics    │ 1      │      │ 1  │ 1          │ 2            │
│ 2  │ HTTP Servers │ 1      │      │ 2  │ 2          │ 3            │
│ 3  │ gRPC Clients │ 1      │      │ 3  │ 1          │ 3            │
│ 4  │ Distributed  │ 1      │      │ 4  │ 3          │ 4            │
│    │ Systems      │        │      └────┴────────────┴──────────────┘
└────┴──────────────┴────────┘

## Topic

```
┌──────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   FRONTEND   │            │   GO BACKEND     │            │   POSTGRESQL     │
└──────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
       │                            │                               │
       │  POST /topic               │  (PLANNED)                    │
       │  { name, tag,              │                               │
       │    difficulty,             │                               │
       │    content }               │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  INSERT INTO topics           │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  Auto-split into              │
       │                            │  atomic micro-skills          │
       │                            │  (cards)                      │
       │                            │                               │
       │  { topic }                 │                               │
       │◄───────────────────────────│                               │
       │                            │                               │
       │  POST /topic/import        │  (PLANNED — bulk)             │
       │  (CSV / Markdown)          │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  Parse & insert               │
       │                            │  multiple topics              │
       │                            │──────────────────────────────►│
       │                            │                               │
```

**Fields**: id, user_id, name, tag, difficulty, estimated_hours, content_path,
created_at
**Service**: Go Backend. Chroma DB (agent) for semantic indexing (planned).
**Storage**: PostgreSQL `topics` table. Raw content in S3/local disk.

## Card (Spaced Repetition)

```
┌──────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   FRONTEND   │            │   GO BACKEND     │            │   POSTGRESQL     │
└──────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
       │                            │                               │
       │  GET /cards/today          │  (PLANNED)                    │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  SELECT * FROM cards          │
       │                            │  WHERE due <= NOW()           │
       │                            │  ORDER BY priority DESC       │
       │                            │  LIMIT 3                      │
       │                            │──────────────────────────────►│
       │                            │                               │
       │  [ { question,             │                               │
       │      answer, ef,           │                               │
       │      interval, due } ]     │                               │
       │◄───────────────────────────│                               │
       │                            │                               │
```

**SM-2 Algorithm Fields**:
```
ef (Easiness Factor):  float  -> updated per answer (min 1.3)
interval:              int    -> days until next review
due:                   timestamp -> next review date
repetitions:           int    -> consecutive correct answers
last_score:            int    -> 0-100 from LLM evaluation
priority:              int    -> computed from weakness + urgency
```

**Fields**: id, user_id, topic_id, question, answer, ef, interval, due,
repetitions, last_score, priority, created_at

## Mission

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   FRONTEND   │   │   GO BACKEND     │   │   HONO AGENT     │   │   POSTGRESQL     │
└──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
       │                    │                       │                     │
        │  POST /chat        │                       │                     │
        │  { message,         │                       │                     │
        │    sessionId }      │                       │                     │
        │───────────────────►│                       │                     │
        │                    │                       │                     │
        │                    │  Validate tier        │                     │
        │                    │  Resolve model        │                     │
        │                    │  (user_preferences)   │                     │
       │                    │                       │                     │
       │                    │  POST /api/            │                     │
       │                    │  generate-mission     │                     │
       │                    │  { prompt,            │                     │
       │                    │    features,           │                     │
       │                    │    provider_config,   │                     │
       │                    │    history,            │                     │
       │                    │    session_id }       │                     │
       │                    │──────────────────────►│                     │
       │                    │                       │                     │
       │                    │                       │  Zod validate       │
       │                    │                       │  resolveTools()     │
       │                    │                       │  createHarness()    │
       │                    │                       │  runMission()       │
       │                    │                       │                     │
        │                    │    SSE Stream         │                     │
        │                    │◄──────────────────────│                     │
        │                    │                       │                     │
        │  X-Session-ID:     │                       │                     │
        │  <session id>      │                       │                     │
        │◄───────────────────│                       │                     │
        │                    │                       │                     │
        │  SSE Stream        │                       │                     │
        │◄───────────────────│                       │                     │
        │                    │                       │                     │
```

**Mission Flow (Planned MVP)**:
```
1. User requests mission OR completes card -> triggers Go service
2. Go calls Agent via HTTP: POST /api/v1/generate-mission
3. Agent fetches user context (cards, weak topics) from Go API
4. Agent queries Chroma for relevant content (RAG)
5. Agent uses LLM to generate mission prompt
6. Agent returns mission via HTTP SSE stream
7. Go stores mission in missions table
```

**Fields**: id, user_id, skill_id, prompt, type (code/read/build), status,
created_at

## Answer

```
┌──────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   FRONTEND   │            │   GO BACKEND     │            │   POSTGRESQL     │
└──────┬───────┘            └────────┬─────────┘            └────────┬─────────┘
       │                            │                               │
       │  POST /answer              │  (PLANNED)                    │
       │  { card_id, text,          │                               │
       │    lang }                  │                               │
       │───────────────────────────►│                               │
       │                            │                               │
       │                            │  LLM Evaluate:                │
       │                            │  correctness 40%              │
       │                            │  depth 30%                    │
       │                            │  clarity 30%                  │
       │                            │  -> score 0-100               │
       │                            │                               │
       │                            │  INSERT INTO answers          │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  UPDATE cards:                │
       │                            │  new EF, interval, due        │
       │                            │──────────────────────────────►│
       │                            │                               │
       │                            │  Embed answer -> Chroma       │
       │                            │  (future similarity           │
       │                            │   search)                     │
       │                            │                               │
       │  { score, feedback,        │                               │
       │    next_micro_task }       │                               │
       │◄───────────────────────────│                               │
       │                            │                               │
```

**Fields**: id, card_id, user_id, text, score (0-100), feedback, created_at

## Full Data Flow Summary

Service Ownership:

┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│     GO BACKEND       │      │     HONO AGENT       │      │       FRONTEND       │
│                      │      │                      │      │                      │
│  users               │      │  MissionPayload      │      │  User                │
│  goals               │      │  HarnessPacket       │      │  Message             │
│  skill_nodes         │      │  ProviderEvent       │      │  StreamPacket        │
│  skill_edges         │      │  AgentState          │      │  ThoughtStep         │
│  topics              │      │  ToolDefinition      │      │  AgentFeature        │
│  cards               │      │  Observation         │      │  TokenUsage          │
│  missions            │      │  Action              │      │  AgentProgress       │
│  answers             │      │  AgentStrategy       │      │  MissionMeta         │
│  ProviderCfg         │      │  LLMProvider         │      │                      │
│  ModelInfo           │      │                      │      │                      │
│  Feature             │      │                      │      │                      │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘

Data flows right (CRUD) and left (read/queries). Agent is stateless compute —
state lives in Redis or memory.

## Strategy Resolution Flow [Active]


New data-flow branch for strategy versioning (see
`docs/shared/patterns/strategy-lifecycle.md`):

```
Client ──POST /chat──► Gateway
                         │
                         ├─ session exists?
                         │    ├─ yes: session.strategy_version pinned?
                         │    │        ├─ yes → use pin (backward compat)
                         │    │        └─ no  → resolve from rollout config
                         │    │                (settings.strategy_rollout)
                         │    └─ no:  resolve from rollout config
                         │
                         ├─ write pin: sessions.strategy_version (immutable)
                         │
                         └─ POST /api/v1/generate-mission
                              payload + strategy_version ("nlah:v1")
                                     │
                                     ▼
                              StrategyRegistry.resolve("nlah:v1")
                                     │
                                     ▼
                              StrategyFactory.create("nlah")
```

Ownership:
- `StrategyRegistryEntry` / `StrategyVersionInfo` — agent (code truth)
- `strategy_rollout` settings JSONB — gateway (operational truth)
- `sessions.strategy_version` — shared state (pin, immutable)

## Entry Points & Exports

- **Go models**: `backend/internal/models/models.go`
- **Agent types**: `agent/src/shared/types/index.ts`
- **Frontend types**: `frontend/web/src/features/chat/types/index.ts`
- **Planned schema**: `docs/architecture-plan.md`

## Source References

+-------------------------------------------------------+-------+--------------------------------------+
| File                                                  | Lines | Role                                 |
+-------------------------------------------------------+-------+--------------------------------------+
| backend/internal/models/models.go                     | 64-72 | User struct                          |
| docs/architecture-plan.md                             | 92-101| Full planned DB schema               |
| docs/requirment_base.md                               | 5-48  | Topic ingestion, spaced rep, agent   |
|                                                       |       |   mission gen, evaluation            |
| agent/src/shared/types/index.ts                       | 10-15 | MissionPayload type                  |
| frontend/web/src/features/chat/types/index.ts         | 48-95 | Message, StreamPacket types          |
+-------------------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
