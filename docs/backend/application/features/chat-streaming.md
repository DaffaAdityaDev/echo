================================================================================
  Chat Streaming - SSE Relay & Agent Communication
================================================================================
  Module    : Chat Streaming
  Service   : backend
  Version   : 1.4
  Updated   : 2026-08-07 (chat request trimmed to {message, sessionId}; config resolved from user_preferences)
================================================================================

Overview
--------

The Chat Streaming feature handles real-time communication between the
frontend client and the agent backend (Hono/Node.js). The Go backend acts as a
proxy/relay: it receives chat requests from the client, forwards them to the
agent with resolved provider configuration, and returns responses as a
Server-Sent Events (SSE) stream.

Single streaming mode: the gateway relays the agent's live SSE stream. There
is no Redis session event store and no replay — a disconnected client's
mission is cancelled (token safety), and the DB snapshot is the recovery
path.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/chat/handler.go         | ChatHandler - HandleChat                   |
|                                          | HandleGetFeatures, HandleGetSkills         |
| internal/service/aimodel/service.go        | ModelService - resolve model to config     |
| internal/service/consolidation/service.go| ConsolidationService - token threshold &   |
|                                          |   session summarization                    |
| internal/repository/session/repository.go| SessionRepository - session CRUD, turn     |
|                                          |   persistence (incremental flush):         |
|                                          |   InsertMessage, InsertAssistantPlaceholder|
|                                          |   UpdateMessageContent, UpdateMessageStatus|
|                                          |   MarkStreamingAsInterrupted              |
| internal/observability/tracer.go         | OpenTelemetry span creation & propagation  |
+------------------------------------------+--------------------------------------------+

Flow Diagram - Chat Stream
--------------------------

   ┌──────────┐       ┌──────────────────┐       ┌──────────────┐       ┌──────────────┐
   │  Client  │       │ Go Backend(Fiber)│       │ Agent(Hono)  │       │ LLM Provider │
   └────┬─────┘       └────────┬─────────┘       └──────┬───────┘       └──────┬───────┘
        │ POST /api/v1/chat    │                        │                      │
        │ {message, sessionId} │                        │                      │
        │  (sessionId opt)     │                        │                      │
        │                      │                        │                      │
        │                      │                        │                      │
        │─────────────────────►│                        │                      │
        │                      │  Validate skills vs    │                      │
        │                      │  catalog (Redis/Hono)  │                      │
        │                      │                        │                      │
        │                      │  Load session +        │                      │
        │                      │  check ownership       │                      │
        │                      │                        │                      │
        │                      │  Check consolidation   │                      │
        │                      │  threshold -> trigger  │                      │
        │                      │  summarization if over │                      │
        │                      │                        │                      │
        │                      │  Resolve model locally │                      │
        │                      │  (ModelService — no    │                      │
        │                      │   network call)        │                      │
        │                      │                        │                      │
        │                      │  POST /api/generate-   │                      │
        │                      │  mission?mode=...      │                      │
        │                      │  {message,history,     │                      │
        │                      │   provider_config,     │                      │
        │                      │   session_id,features, │                      │
        │                      │   skills,traceparent}  │                      │
        │                      │───────────────────────►│                      │
        │                      │                        │  LLM call            │
        │                      │                        │─────────────────────►│
        │                      │                        │  SSE stream          │
        │                      │                        │◄─────────────────────│
        │  SSE:text/event-stream                        │                      │
        │◄─────────────────────│ (relay raw bytes)      │                      │
        │  (chunked transfer)  │                        │                      │
         │                      │  Before stream:        │                      │
         │                      │    Auto-create session │                      │
         │                      │    Set X-Session-ID    │                      │
         │                      │      response header   │                      │
         │                      │      (always — session │                      │
         │                      │      id in use)        │                      │
         │                      │    Save user msg (PG)  │                      │
         │                      │    Insert assistant    │                      │
         │                      │      placeholder       │                      │
         │                      │    (status=streaming)  │                      │
         │                      │                        │                      │
         │                      │  During stream:        │                      │
         │                      │    Flush goroutine     │                      │
         │                      │    (UPDATE PG content  │                      │
         │                      │     every 2s)          │                      │
         │                      │                        │                      │
         │                      │  On stream end:        │                      │
         │                      │    Stop flush goroutine│                      │
         │                      │    UPDATE PG:          │                      │
         │                      │      content + steps   │                      │
         │                      │      + status          │                      │
         │                      │    (complete/interrupted)                       │

Message Flow - HandleChat
-------------------------

   POST /api/v1/chat
     │
     ├─ Parse JSON body -> ChatRequest{Message, SessionID}
     │
     ├─ Parse "traceparent" header for distributed tracing
     │     └─ If valid: inject remote span context
     │
     ├─ Extract user_id from JWT (c.Locals("user_id")), assert int
     │     └─ Missing/invalid: 401
     │
     ├─ Start OTel span "HandleChat" with attributes:
     │      agent.session_id, mission.id, llm.model
     │
     ├─ Tier from signed JWT "tier" claim (default: "free")
     │
     ├─ Feature gating via FeaturesSvc.ValidateRequest (features resolved
     │      from user_preferences — never from the request):
     │      Fetch catalog from Redis cache -> Hono fallback
     │      Build catalog map[ID]Feature
     │      For each requested feature ID:
     │        If user tier is "free" and feature requires "pro":
     │          403 { "error": "Feature 'X' requires a Pro subscription." }
     │
     ├─ Resolve model (user_preferences) -> ProviderConfig via ModelService
     │     (LOCAL, no network)
     │     └─ On failure: 400 { "error": "Provider config error: ..." }
     │
     ├─ Validate skills (when user_preferences list skills):
     │      Fetch skill catalog via GetSkills (Redis cache -> Hono fallback)
     │      Build map[string]bool from catalog names
     │      For each requested skill:
     │        400 { "error": "Unknown skill '...'" } if not found
     │
     ├─ Session loading & ownership check (when req.SessionID != ""):
     │      Load session via SessionRepo.GetByID(ctx, req.SessionID)
     │        DB error         -> 500
     │        nil / deleted    -> 404 { "error": "Session not found" }
     │        session.UserID != userID -> 403 { "error": "Forbidden: ownership mismatch" }
     │
     │      Consolidation threshold check:
     │        ConsolidationSvc.CheckThreshold(ctx, req.SessionID)
     │        If true:
     │          log auto-consolidation
     │          ConsolidationSvc.TriggerConsolidation(ctx, req.SessionID, providerMap)
     │          On success: reload session from DB (context summary updated)
     │
     │      Load existing messages via SessionRepo.GetSessionMessages
     │      Prepend ContextSummary as system message if non-empty
     │      Convert DB messages to HistoryMessage[]:
     │        Strip thought, tool_call, tool_result roles
     │
      │
       ├─ Auto-create session (when req.SessionID == ""):
       │     CreateSession(ctx, userID, "New Chat")
       │     Set req.SessionID = session.ID
       │     X-Session-ID response header = req.SessionID
       │
       ├─ Strategy resolution [Active] — AFTER session load/auto-create:
       │     ResolveVersion(pinnedVersion, userID)
       │     If pinned version set -> use it (backward compatibility)
       │     Else -> resolve via rollout config (settings table)
       │     Pin written to session when empty
       │     Deprecated versions excluded from new-session resolution.
       │     See docs/shared/patterns/strategy-lifecycle.md
      │
      ├─ Acquire per-session lock (serializes concurrent turns)
      │     nextTurn = GetMaxTurnNumber(sessionID) + 1  (inside the lock)
      │
      ├─ Save user message + assistant placeholder (one PrepareTurn tx):
      │     MarkStreamingAsInterrupted(sessionID) — stale streaming -> interrupted
      │     InsertMessage(ctx, sessionID, "user", content, tokenCount, nextTurn, "complete")
      │     InsertAssistantPlaceholder(ctx, sessionID, nextTurn)
      │     Returns assistantMsgID for later updates
      │
       └─ Build agent payload:
      │      user_id, message, model, history, provider_config, session_id,
      │      features (ALWAYS included, guaranteed [] not null),
      │      skills (only when non-empty),
      │      strategy_version (resolved version string, e.g. "nlah:v1")
     │
     ├─ POST to agent /api/generate-mission?mode=<Mode (from preferences)>
     │      Headers: Content-Type, X-Internal-Token, traceparent
     │
     │   ┌─ Error: 500 { "error": "Agent service unreachable" }
     │   └─ Non-200: { "error": "Agent request failed", "details": <agent body> }
     │        — the agent's HTTP status code is passed through
     │
     ├─ Set SSE headers:
     │      Content-Type: text/event-stream
     │      Cache-Control: no-cache, no-transform
     │      Connection: keep-alive
     │      Transfer-Encoding: chunked
     │      X-Accel-Buffering: no
     │
      └─ SendStreamWriter -> relay agent response body bytes -> client

           bufio.NewReader(resp.Body) -> read lines -> w.Write -> w.Flush

           struct streamContent (sync.RWMutex protected):
             content, thinking   strings.Builder
             toolCalls, toolResults []ToolCallCapture, []ToolCallResult
             isComplete          bool

           Start flush goroutine (2s ticker, context.WithCancel + done channel):
             ticker -> RLock content -> UPDATE messages SET content WHERE id = assistantMsgID

           Parse incoming SSE "data: {...}" packets, Lock/unlock streamContent:
             type "content"     -> sc.content.WriteString()
             type "reasoning"   -> sc.thinking.WriteString()
             type "tool_call"   -> append to sc.toolCalls
             type "tool_result" -> append to sc.toolResults
             type "turn_complete" -> sc.isComplete = true

           On stream EOF (rErr != nil):
             1. cancel() flush context; WAIT for flush goroutine to join
                (channel, 10s timeout guard) — no late UPDATE can race
             2. RLock streamContent -> read final content + thinking + toolCalls + isComplete
             3. Build steps JSON from thinking + toolCalls + toolResults
             4. One CompleteTurn transaction (retry x3, 10s DB timeout):
                  UPDATE content + steps + token_count
                  UPDATE status ('complete' when turn_complete seen, else 'interrupted')
                  UPDATE sessions.updated_at

Consolidation Trigger
---------------------

Trigger point: after session ownership check, before loading messages.

  ConsolidationSvc.CheckThreshold(ctx, sessionID)
    └─ Queries GetSessionTokenCount from DB
       Threshold: cfg.PRUNE_THRESHOLD (default 100,000)
    └─ Returns true if tokenCount >= threshold

  If threshold crossed:
    ConsolidationSvc.TriggerConsolidation(ctx, sessionID, providerMap)
      └─ Determines pruneBoundary = maxTurn - PRUNE_KEEP_LATEST_TURNS (default 10)
      └─ Loads messages up to pruneBoundary
      └─ POST to Agent /api/internal/sessions/summarize
           Body: { session_id, messages, max_summary_tokens, provider_config }
           Header: X-Internal-Token
      └─ On success:
           Update ContextSummary (append new summary)
           DeleteMessagesUpToTurn(sessionID, pruneBoundary)
      └─ Reload session after consolidation so context summary is fresh

Session loading re-fetches the session after consolidation to pick up the
updated ContextSummary.

> **Background consolidation [Active]**: the inline fast-path above stays.

> A lifecycle worker (see `docs/backend/infrastructure/server-lifecycle.md`)
> additionally runs consolidation for stale sessions (threshold + `last_accessed_at`
> windows) so active chat latency is not affected by long sessions.
> Decay scoring: `docs/agent/domain/memory-and-retrieval-strategy.md`.

Skill Catalog — HandleGetSkills
-------------------------------

  GET /api/v1/skills
    │
    └─ HandleGetSkills(c)
         └─ GetSkills(ctx)
              │
              ├─ Check Redis cache key "agent:skills" (TTL 10 min)
              │     └─ Cache hit -> return []map[string]interface{}
              │
              ├─ GET <HonoAPIURL>/api/skills
              │      Header: X-Internal-Token
              │
              ├─ Parse response -> []map[string]interface{}{name, ...}
              │
              └─ Store in Redis with 10 min TTL -> return

  Used by HandleChat to validate the user's skills (from user_preferences)
  against known skill names.

  Route registration (router.go:144): api.Get(routes.V1PathSkills, chatHandler.HandleGetSkills)

Turn Persistence — Incremental PG Flush
----------------------------------------

Messages are no longer saved only at turn completion. The new flow saves the
user message immediately and incrementally flushes assistant content during
streaming, ensuring data survival on page refresh or disconnect.

  Before stream starts:
    1. Auto-create session (if req.SessionID == "")
    2. Mark all previous 'streaming' messages as 'interrupted'
    3. INSERT user message:
         Role: "user", Content: req.Message, status: "complete"
    4. INSERT assistant placeholder:
         Role: "assistant", Content: "", status: "streaming"
         Returns assistantMsgID

  Token counts (exact, no chars/4 estimation):
    - User message: POST agent /api/internal/tokenize (official tiktoken BPE,
      o200k_base) BEFORE the per-session lock — see handler/chat/tokens.go.
      The tokenize call is an HTTP round-trip; it runs outside the lock so a
      slow tokenizer never serializes every message in the session. Only
      PrepareTurn (maxTurn + insert placeholder) happens inside the lock.
    - Assistant message: captured from the agent's `usage` packet
      (completionTokens reported by the LLM provider)
    - Fallback: chars/4 approximation ONLY if the agent tokenizer is
      unreachable (logged)

  History capping (handler/chat/history.go — capHistory):
    - Session history is loaded newest-first and kept only while accumulated
      token_count <= HISTORY_MAX_TOKENS (default 50,000); older messages are
      dropped. Single-message content is truncated to HISTORY_MAX_MSG_CHARS
      (default 100,000 chars) with a "[truncated]" marker.
    - Prevents multi-MB payloads (e.g. 1M-context stress sessions: 88 MB →
      1 truncated message) from being forwarded to the agent.
    - Auto-consolidation is skipped when the session total exceeds
      CONSOLIDATION_SKIP_TOKENS (default 200,000).

  During stream (flush goroutine):
    - Background goroutine with context.WithCancel + done channel
    - Ticker every 2 seconds
    - RLock streamContent -> read accumulated content + latest usage
      completionTokens
    - UPDATE messages SET content = $2, token_count = $3 WHERE id = assistantMsgID
    - If content empty, skip (no unnecessary writes)
    - 3s timeout per flush call (retried x3 with backoff)

  On stream EOF (rErr != nil — NOT on turn_complete receipt):
    1. cancel() -> stop flush goroutine; WAIT for it to join (done channel,
       timeout guard) so a late flush UPDATE cannot race the finalize
    2. RLock streamContent -> read final state
    3. Build steps JSON (reasoning + tool_calls + tool_results)
    4. Determine status:
         turn_complete packet seen: status = "complete"
         otherwise:                 status = "interrupted"
    5. ONE CompleteTurn transaction (retry x3, 10s DB timeout):
         UPDATE messages SET content + steps + token_count + status
         UPDATE sessions SET updated_at = NOW()

  Key guarantees:
    - User message is ALWAYS persisted (saved before stream starts)
    - Partial assistant content is flushed every 2s (survives crash/refresh)
    - Finalize runs at stream EOF — the turn_complete packet only flips the
      status flag; there are no separate UPDATE calls
    - No stale 'streaming' messages (marked 'interrupted' before new turn)
    - Flush goroutine is joined before the final write (no race condition)

Disconnect Handling
-------------------

Missions are cancelled when the client disconnects (token safety): the agent's
`CancellationManager` fires on stream abort and the harness throws
`STREAM_CONSTANTS.CANCELLED_MESSAGE`, emitted as an `error` packet. The
gateway's relay loop keeps flushing partial content to the DB (every 2s) and
finalizes the turn with `CompleteTurn` — `complete` on `turn_complete`,
`interrupted` otherwise. There is no replay: after a refresh, messages rebuild
from the DB snapshot (`GET /sessions/:id/messages`), and a disconnect-cancelled
turn shows as interrupted in the UI ("send a reply to continue").

Feature Catalog - GetFeatures / HandleGetFeatures
--------------------------------------------------

  GetFeatures(ctx)
    │
    ├─ Check Redis cache key "agent:features" (TTL 10 min)
    │     └─ Cache hit -> return
    │
    ├─ GET <HonoAPIURL>/api/features
    │      Header: X-Internal-Token
    │
    ├─ Parse response -> []ImplementedFeature{ID, Name, Description}
    │     (agent's implemented registry — no tier/ui_schema)
    │
    ├─ Merge with DB features table (009_create_features):
    │     tier_requirement, ui_schema, status -> []Feature
    │
    └─ Store in Redis with 10 min TTL -> return

  HandleGetFeatures(c) — returns user-facing FeatureResponse{ID, Name, Description, Locked}.
    Locked = true when userTier=="free" && feature.TierRequirement=="pro".

Entry Points & Exports
----------------------

+--------------------------------------------+------------+----------------------------+
| Symbol                                     | Kind       | Path                       |
+--------------------------------------------+------------+----------------------------+
| NewHandler(cfg, rdb, modelSvc,             | Constructor| chat/handler.go:73         |
|   sessionRepo, consolidationSvc,           |            |                            |
|   strategySvc, featuresSvc)                |            |                            |
| HandleChat(c)                              | Method     | chat/handler.go:148        |
| HandleGetSkills(c)                         | Method     | chat/handler.go:802        |
| GetSkills(ctx)                             | Method     | chat/handler.go:743        |
| HandleApproveTool(c)                       | Method     | chat/handler.go:668        |
| HandleDenyTool(c)                          | Method     | chat/handler.go:682        |
| HandleGetFeatures(c)                       | Method     | handler/features/handler.go:27  |
| GetImplementedSet(ctx)                     | Method     | service/features/service.go:71 |
| ResolvePublicCatalog(ctx, tier)            | Method     | service/features/service.go:119 |
| InsertMessage(ctx, sessionID, role,        | Method     | session/repository.go      |
|   content, tokenCount, turnNumber, status) |            |                            |
| InsertAssistantPlaceholder(ctx, sessionID, | Method     | session/repository.go      |
|   turnNumber)                              |            |                            |
| PrepareTurn(ctx, sessionID, userContent,   | Method     | session/repository.go      |
|   userTokenCount, turnNumber)              |            |                            |
| CompleteTurn(ctx, msgID, sessionID,        | Method     | session/repository.go      |
|   content, steps, tokenCount, status)      |            |                            |
| UpdateMessageContent(ctx, msgID, content,  | Method     | session/repository.go      |
|   steps, tokenCount)                       |            |                            |
| UpdateMessageStatus(ctx, msgID, status)    | Method     | session/repository.go      |
| MarkStreamingAsInterrupted(ctx, sessionID) | Method     | session/repository.go      |
| UpdateSessionTimestamp(ctx, sessionID)     | Method     | session/repository.go      |
+--------------------------------------------+------------+----------------------------+

Dependencies
------------

+-------------------------------------+-------------------------------------------+
| Dependency                          | Used For                                  |
+-------------------------------------+-------------------------------------------+
| github.com/gofiber/fiber/v3         | HTTP server, SSE headers, stream writer   |
| github.com/redis/go-redis/v9        | Redis PubSub (SaaS mode), feature/skill   |
|                                     |   cache                                   |
| go.opentelemetry.io/otel/trace      | Span creation, traceparent parsing        |
| service.ModelService                | Resolve model -> provider config          |
| repository.SessionRepository        | Session CRUD, message persistence,        |
|                                     |   incremental flush (InsertMessage,       |
|                                     |   UpdateMessageContent, UpdateMessageStatus|
|                                     |   MarkStreamingAsInterrupted)             |
| service.ConsolidationService        | Token threshold check, auto-consolidation |
|                                     |   via agent summarization                 |
+-------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/handler/chat/handler.go - Chat + stream + skill handlers
- internal/handler/features/handler.go - HandleGetFeatures
- internal/service/features/service.go - GetImplementedSet, ResolvePublicCatalog, ValidateRequest
- internal/service/aimodel/service.go - Model resolution for provider config
- internal/service/consolidation/service.go - Token threshold & summarization
- internal/repository/session/repository.go - Session persistence, incremental flush
- internal/observability/tracer.go - Tracer init, TrackAgentTurn helper
- internal/router/router.go:143-150 - Route registrations
- internal/constants/db/postgres.go - SQL queries (InsertMessageWithStatus, UpdateMessageContent, etc.)

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
