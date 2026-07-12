================================================================================
  Chat Streaming - SSE Relay & Agent Communication
================================================================================
  Module    : Chat Streaming
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-10
================================================================================

Overview
--------

The Chat Streaming feature handles real-time communication between the
frontend client and the agent backend (Hono/Node.js). The Go backend acts as a
proxy/relay: it receives chat requests from the client, forwards them to the
agent with resolved provider configuration, and returns responses as a
Server-Sent Events (SSE) stream.

Two streaming modes are available:
  - Local mode : Reverse-proxy directly to the Hono SSE stream (in-memory Node
                 stream).
  - SaaS mode  : Subscribe to the Redis PubSub channel stream:<missionId>
                 populated by the agent.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/handler/chat_handler.go         | ChatHandler - HandleChat, StreamMissionLogs|
|                                          | HandleGetFeatures, HandleGetSkills         |
| internal/service/model_service.go        | ModelService - resolve model to config     |
| internal/service/consolidation_service.go| ConsolidationService - token threshold &   |
|                                          |   session summarization                    |
| internal/repository/session_repository.go| SessionRepository - session CRUD, turn     |
|                                          |   persistence via SaveTurnMessages         |
| internal/observability/tracer.go         | OpenTelemetry span creation & propagation  |
+------------------------------------------+--------------------------------------------+

Flow Diagram - Chat Stream
--------------------------

   ┌──────────┐       ┌──────────────────┐       ┌──────────────┐       ┌──────────────┐
   │  Client  │       │ Go Backend(Fiber)│       │ Agent(Hono)  │       │ LLM Provider │
   └────┬─────┘       └────────┬─────────┘       └──────┬───────┘       └──────┬───────┘
        │ POST /api/v1/chat    │                        │                      │
        │ {message,model,      │                        │                      │
        │  sessionId,missionId,│                        │                      │
        │  history,features,   │                        │                      │
        │  skills}             │                        │                      │
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
        │                      │   missionId,features,  │                      │
        │                      │   skills,traceparent}  │                      │
        │                      │───────────────────────►│                      │
        │                      │                        │  LLM call            │
        │                      │                        │─────────────────────►│
        │                      │                        │  SSE stream          │
        │                      │                        │◄─────────────────────│
        │  SSE:text/event-stream                        │                      │
        │◄─────────────────────│ (relay raw bytes)      │                      │
        │  (chunked transfer)  │                        │                      │
        │                      │  On turn_complete:     │                      │
        │                      │    SaveTurnMessages    │                      │
        │                      │    (user, assistant,   │                      │
        │                      │     thought,           │                      │
        │                      │     tool_call,         │                      │
        │                      │     tool_result)       │                      │
        │                      │    10s timeout ctx     │                      │
        │                      │                        │                      │

Message Flow - HandleChat
-------------------------

   POST /api/v1/chat
     │
     ├─ Parse JSON body -> ChatRequest{Message, Model, Mode, SessionID,
     │     MissionID, History, Features, Skills}
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
     ├─ Read X-User-Tier header (default: "pro")
     │
     ├─ Feature gating (when len(req.Features) > 0):
     │      Fetch catalog from Redis cache -> Hono fallback
     │      Build catalog map[ID]Feature
     │      For each requested feature ID:
     │        If user tier is "free" and feature requires "pro":
     │          403 { "error": "Feature 'X' requires Pro" }
     │
     ├─ Resolve model -> ProviderConfig via ModelService (LOCAL, no network)
     │     └─ On failure: 400 { "error": "Unknown model '...'" }
     │
     ├─ Validate skills (when len(req.Skills) > 0):
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
     │        Track nextTurn = max(existing turn) + 1
     │
     └─ Fallback (no SessionID):
          history = req.History (client-provided)
          nextTurn = 1

     ├─ Build agent payload:
     │      user_id, message, model, history, provider_config, missionId,
     │      features (ALWAYS included, guaranteed [] not null),
     │      skills (only when non-empty)
     │
     ├─ POST to agent /api/generate-mission?mode=<Mode>
     │      Headers: Content-Type, X-Internal-Token, traceparent
     │
     │   ┌─ Error: 500 { "error": "Agent service unreachable" }
     │   └─ Non-200:  { "error": "Agent request failed", "details": ... }
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

          Parse incoming SSE "data: {...}" packets into AgentSSEPacket:
            type "content"     -> append to assistantBuilder
            type "reasoning"   -> append to thinkingBuilder
            type "tool_call"   -> append to toolCalls slice
            type "tool_result" -> append to toolResults slice
            type "turn_complete" -> set isComplete = true

          On stream end (rErr != nil):
            if isComplete && req.SessionID != "":
              commit turn via SaveTurnMessages (see Turn Persistence section)

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

  Used by HandleChat to validate req.Skills against known skill names.

  Route registration (router.go:60): api.Get(routes.V1PathSkills, chatHandler.HandleGetSkills)

Turn Persistence — SaveTurnMessages
------------------------------------

After the SSE stream completes and a turn_complete packet is received, if
SessionID was provided, the handler commits the turn atomically:

  1. Build user message:
       Role:       "user"
       Content:    req.Message
       TokenCount: len(content)/4 (min 1)
       TurnNumber: nextTurn

  2. Build assistant message:
       Role:       "assistant"
       Content:    accumulated assistantBuilder content
       TokenCount: len(content)/4 (min 1)
       TurnNumber: nextTurn

  3. Build auxiliary messages (if present):
       - thought (if thinkingBuilder.Len() > 0):
           Role: "thought", Content: reasoning text
       - tool_call (for each toolCalls entry):
           Role: "tool_call"
           Content: JSON {"toolName":"...","toolInput":...}
       - tool_result (for each toolResults entry):
           Role: "tool_result"
           Content: "<toolName> result: <content>"

  4. Commit with timeout:
       dbCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
       SessionRepo.SaveTurnMessages(dbCtx, sessionID, userMsg, assistantMsg, toolResults)

       SaveTurnMessages runs in a DB transaction:
         1. INSERT user message
         2. INSERT assistant message
         3. INSERT each tool result (thought, tool_call, tool_result)
         4. UPDATE session set updated_at = now()
         5. COMMIT

  5. On error: log warning, no client-facing error (stream already closed).
     On success: log "[CHAT] Successfully persisted turn N for session X"

  Note: The 10s timeout context is separate from the request context — it uses
  context.Background() so it outlives the HTTP request lifecycle.

Mission Log Streaming - StreamMissionLogs
-----------------------------------------

  GET /api/v1/missions/:missionId/stream
    │
    ├─ Read AGENT_RUNTIME_MODE env var
    │      Default: "local"
    │
    ├─ Set SSE headers (same as HandleChat)
    │
    ├─ if mode == "saas":
    │      Subscribe Redis PubSub "stream:<missionId>"
    │      Loop: read channel -> write "data: <payload>\n\n" -> flush
    │      Heartbeat every 15s -> ": heartbeat\n\n"
    │      Stop on ctx.Done()
    │
    └─ if mode == "local" (default):
          GET <HonoAPIURL>/api/v1/missions/<missionId>/stream
          Reverse-proxy: read line -> write line -> flush

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
    ├─ Parse response -> []Feature{ID, Name, Description, TierRequirement}
    │
    └─ Store in Redis with 10 min TTL -> return

  HandleGetFeatures(c) — returns user-facing FeatureResponse{ID, Name, Description, Locked}.
    Locked = true when userTier=="free" && feature.TierRequirement=="pro".

Entry Points & Exports
----------------------

+--------------------------------------------+------------+----------------------------+
| Symbol                                     | Kind       | Path                       |
+--------------------------------------------+------------+----------------------------+
| NewChatHandler(cfg, rdb, modelSvc,         | Constructor| chat_handler.go:36         |
|   sessionRepo, consolidationSvc)           |            |                            |
| HandleChat(c)                              | Method     | chat_handler.go:107        |
| StreamMissionLogs(c)                       | Method     | chat_handler.go:462        |
| HandleGetFeatures(c)                       | Method     | chat_handler.go:685        |
| HandleGetSkills(c)                         | Method     | chat_handler.go:675        |
| GetFeatures(ctx)                           | Method     | chat_handler.go:569        |
| GetSkills(ctx)                             | Method     | chat_handler.go:622        |
| SaveTurnMessages(ctx, sessionID, userMsg,  | Method     | session_repository.go:137  |
|   assistantMsg, toolResults)               |            |                            |
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
|                                     |   turn commit via SaveTurnMessages        |
| service.ConsolidationService        | Token threshold check, auto-consolidation |
|                                     |   via agent summarization                 |
+-------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/handler/chat_handler.go - All chat, stream, feature, and skill handlers
- internal/service/model_service.go - Model resolution for provider config
- internal/service/consolidation_service.go - Token threshold & summarization
- internal/repository/session_repository.go - Session persistence, SaveTurnMessages
- internal/observability/tracer.go - Tracer init, TrackAgentTurn helper
- internal/router/router.go:59-61 - Route registrations

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
