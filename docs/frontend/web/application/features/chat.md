================================================================================
  Chat Feature
================================================================================
  Module    : Chat Feature
  Service   : Web
  Version   : 1.2
  Updated   : 2026-08-06 (recovery persistence, step-timeline dedup removal, replay_done)
================================================================================

## Deskripsi

The core conversation feature. Manages real-time chat with AI agents via Server-Sent Events (SSE), displays messages with rich thought-process rendering (tool calls, sub-agent delegations, swarm research), and provides a sidebar for session/model/feature/mode selection.

## Large Message Rendering

Messages longer than `LARGE_MESSAGE_THRESHOLD` (50,000 chars) are NOT rendered
through the Markdown pipeline by default — that would freeze the browser on
multi-MB payloads. Instead `MessageItem.tsx` renders:

1. A warning badge with real size (`4.5 MB · ~1,119k tokens`).
2. A plain-text preview (first 50k chars, `max-h-64` scroll).
3. Two buttons: **Load full message** (renders the full content as plain
   `whitespace-pre-wrap` text — safe for 1M-context payloads) and **Render as
   markdown (heavy)** (opt-in full Markdown render, intentionally slow).

`chat-api.ts` `getMessages` uses a 120s timeout (default axios timeout is 30s)
because a single 10-message page of the 1M-context stress session is ~43 MB.

### Stress Test Procedure (1M Context)

```bash
cd backend
# Safe mode (default): only ensures the admin user exists — never truncates.
go run ./cmd/db/seed

# Load test (dev only): TRUNCATES sessions, then seeds 1 stress session
# (20 messages x ~4.5 MB / ~1.1M tokens) + 50 bulk sessions (1,000 realistic
# multi-paragraph messages, ~2-3 KB each).
go run ./cmd/db/seed --load-test
```

Guards: refused when `APP_ENV=production`, requires interactive `yes`
confirmation before truncation. After seeding, open the room
`🔥 Stress Test Session (1M Context)` in the sidebar and use the
"Load full message" button to render the full context.

## File Structure

```
src/features/chat/
├── constants.ts
├── index.ts
├── constants.ts
├── hooks/
│   ├── useChatPage.ts
│   ├── useChatStream.ts
│   ├── useFeatures.ts
│   ├── useModels.ts
│   ├── useSessions.ts
│   └── useSkills.ts
├── components/
│   ├── AgentProgress.tsx
│   ├── AgentStatusBadge.tsx
│   ├── ChatInput.tsx
│   ├── ChatPage.tsx
│   ├── DegradationToast.tsx
│   ├── MessageItem.tsx
│   ├── MessageList.tsx
│   ├── SessionSidebar.tsx
│   ├── Sidebar.tsx            (re-export: SessionSidebar as default)
│   └── ToolCallTimeline.tsx
├── services/
│   └── chat-api.ts
├── stores/
│   └── chatStore.ts
└── types/
    └── index.ts
```

## Flow Diagrams

### Component Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          ChatPage (orchestrator)                           │
│                                                                            │
│  ┌──────────────────────┐    ┌─────────────────────────────────────────┐   │
│  │   SessionSidebar     │    │              MessageList                │   │
│  │ ┌──────────────────┐ │    │  ┌───────────────────────────────────┐  │   │
│  │ │ Sessions list    │ │    │  │          MessageItem[]           │  │   │
│  │ │ (CRUD)           │ │    │  │  ┌───────────────────────────┐   │  │   │
│  │ │                  │ │    │  │  │ collapsible thought steps │   │  │   │
│  │ ├──────────────────┤ │    │  │  └───────────────────────────┘   │  │   │
│  │ │ Workspace Modes  │ │    │  └──────────────────────────────────┘  │   │
│  │ │ (Std / Agent)    │ │    └─────────────────────────────────────────┘   │
│  │ ├──────────────────┤ │                                                │
│  │ │ Agent Capability │ │    ┌─────────────────────────────────────────┐   │
│  │ │ checkboxes       │ │    │            ToolCallTimeline             │   │
│  │ ├──────────────────┤ │    │  (collapsible tool call list below      │   │
│  │ │ Model picker     │ │    │   last assistant message)               │   │
│  │ ├──────────────────┤ │    └─────────────────────────────────────────┘   │
│  │ │ User / Logout    │ │                                                │
│  │ └──────────────────┘ │    ┌─────────────────────────────────────────┐   │
│  └──────────────────────┘    │           AgentProgress                 │   │
│                              │  ┌───────────────────────────────────┐  │   │
│  ┌──────────────────────┐    │  │ Progress bar + status message     │  │   │
│  │   AgentStatusBadge   │    │  │ Iteration counter                 │  │   │
│  │   (in header)        │    │  │ URL swarm detail (expandable)     │  │   │
│  └──────────────────────┘    │  └───────────────────────────────────┘  │   │
│                              └─────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                         ChatInput                                 │   │
│  │               ┌──────────────────────┐  ┌──────┐                   │   │
│  │               │  Text input          │  │ Send │                   │   │
│  │               └──────────────────────┘  └──────┘                   │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     DegradationToast                              │   │
│  │  (fixed toast when agentState === 'degraded', auto-dismiss 8s)    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

### SSE Stream Consumption (useChatStream)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        sendMessage(text)                                    │
│                              │                                              │
│              ┌───────────────┴───────────────┐                              │
│              v                               v                              │
│   ┌──────────────────────┐   ┌──────────────────────────────────┐           │
│   │ push userMessage +   │   │ api.stream<StreamPacket>(        │           │
│   │ empty assistantMsg   │   │   POST /chat/stream, payload,    │           │
│   │ to store              │   │   onChunk, { signal }           │           │
│   └──────────────────────┘   └────────────────┬─────────────────┘           │
│                                               v                              │
│                               ┌──────────────────────────────────┐           │
│                               │     for each SSE line:           │           │
│                               │ ┌──────────────────────────────┐ │           │
│                               │ │ "metadata"           → set   │ │           │
│                               │ │                       mission│ │           │
│                               │ │                       meta   │ │           │
│                               │ │ "usage"              → set   │ │           │
│                               │ │                       token  │ │           │
│                               │ │                       usage  │ │           │
│                               │ │ "content"            → append│ │           │
│                               │ │                       text   │ │           │
│                               │ │ "reasoning"          → append│ │           │
│                               │ │                       to last│ │           │
│                               │ │                       reason.│ │           │
│                               │ │ "tool_call"          → push  │ │           │
│                               │ │                       step   │ │           │
│                               │ │ "tool_result"        → push  │ │           │
│                               │ │                       step   │ │           │
│                               │ │ "tool_skip"          → push  │ │           │
│                               │ │                       step   │ │           │
│                               │ │ "todo"               → push  │ │           │
│                               │ │                       todo   │ │           │
│                               │ │ "subagent_           → push  │ │           │
│                               │ │  call/result"          subag.│ │           │
│                               │ │ "file_operation"     → push  │ │           │
│                               │ │                       file op│ │           │
│                               │ │ "swarm_status"       → update│ │           │
│                               │ │                       Agent  │ │           │
│                               │ │                       Progr. │ │           │
│                               │ │ "heartbeat"          → update│ │           │
│                               │ │                       agent  │ │           │
│                               │ │                       status │ │           │
│                               │ │ "state_change"       → set   │ │           │
│                               │ │                       agent  │ │           │
│                               │ │                       state  │ │           │
│                               │ │ "degraded"           → set   │ │           │
│                               │ │                       agent  │ │           │
│                               │ │                       state  │ │           │
│                               │ │ "progress"           → update│ │           │
│                               │ │                       iterat.│ │           │
│                               │ │ "turn_complete"      → set   │ │           │
│                               │ │                       comple.│ │           │
│                               │ │                       + usage│ │           │
│                               │ └──────────────────────────────┘ │           │
│                               └──────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────────────────┘
```

> Packet dispatch now lives in `services/applyStreamPacket.ts` (shared between
> the live `POST /chat/stream` handler and the replay path). The live phase
> pushes EVERY step packet — distinct tool calls to the same tool, repeated
> todo snapshots and sub-agent delegations are never collapsed. The replay
> phase skips step packets entirely, since the DB message already carries them.

### Mission Recovery After Refresh (`recoverMission`)

When a session with assistant content loads, `useChatPage` calls
`recoverMission(activeSessionId)` (the gateway treats `missionId` as the
session id). It opens `GET /api/v1/missions/{id}/stream` through the
`/api/missions/[id]/stream` route handler:

- Cursor (`echo:mission-cursor:{missionId}` in localStorage, last Redis
  stream id) → replay missed packets after the cursor, then live tail.
- No cursor → live tail only (no full replay, avoiding duplication with
  content already restored from the database).
- Replay skips `content`/`reasoning` and step packets (already persisted in
  the DB message); an unexpired `hitl_approval_required` re-opens the HITL
  modal; the `replay_done` marker switches the client to live application;
  terminal packets close the stream and clear the cursor.
- On completion `recoverMission` invalidates the messages query so the
  snapshot reflects the persisted completion (the Go SaaS relay finalizes the
  DB message on a terminal packet). While the snapshot is still stale
  (`status: interrupted` — local mode, or before the relay persists),
  `useChatPage` suppresses the snapshot rebuild so the recovered store content
  is not clobbered; the suppression clears when the snapshot catches up or the
  active session changes.

## Entry Points & Exports

### Barrel (`src/features/chat/index.ts`)

+-------------+-------------+------------------------------------------+
| Export        | Kind        | Source                                   |
+---------------+-------------+------------------------------------------+
| ChatPage      | Component   | components/ChatPage.tsx                  |
| ChatInput     | Component   | components/ChatInput.tsx                 |
| MessageList   | Component   | components/MessageList.tsx               |
| MessageItem   | Component   | components/MessageItem.tsx               |
| SessionSidebar| Component   | components/SessionSidebar.tsx            |
| AgentProgress | Component   | components/AgentProgress.tsx             |
| ToolCallTimeline| Component | components/ToolCallTimeline.tsx          |
| ModelSelectorModal| Component| components/ModelSelectorModal.tsx        |
| DebugDrawer   | Component   | components/DebugDrawer.tsx               |
+---------------+-------------+------------------------------------------+
| useChatPage   | Hook        | hooks/useChatPage.ts                     |
| useChatStream | Hook        | hooks/useChatStream.ts                   |
| useModels     | Hook        | hooks/useModels.ts                       |
| useSessions   | Hook        | hooks/useSessions.ts                     |
| useFeatures   | Hook        | hooks/useFeatures.ts                     |
| useSkills     | Hook        | hooks/useSkills.ts                       |
+---------------+-------------+------------------------------------------+
| (all types)   | Type        | types/index.ts                           |
+---------------+-------------+------------------------------------------+

### Components (not barrel-exported, used internally)

+-------------------+----------------------------------+----------------------------------------------------+
| Component         | File                             | Props                                              |
+-------------------+----------------------------------+----------------------------------------------------+
| ChatPage          | components/ChatPage.tsx           | 42 props: selectedModel, setSelectedModel,         |
|                   |                                  | mode, setMode, selectedFeatures,                   |
|                   |                                  | setSelectedFeatures, features, featuresLoading,    |
|                   |                                  | featuresError, models, messages, isLoading,        |
|                   |                                  | agentProgress, sendMessage, clearMessages,         |
|                   |                                  | sidebarOpen, onToggleSidebar, user, onLogout,      |
|                   |                                  | sessions, activeSessionId, createSession,          |
|                   |                                  | deleteSession, selectSession.                      |
|                   |                                  | Renders SessionSidebar + header with               |
|                   |                                  | AgentStatusBadge + MessageList +                   |
|                   |                                  | ToolCallTimeline + AgentProgress + ChatInput +     |
|                   |                                  | DegradationToast.                                  |
+-------------------+----------------------------------+----------------------------------------------------+
| SessionSidebar    | components/SessionSidebar.tsx     | 56 props: sessions, activeSessionId,               |
|                   |                                  | createSession, deleteSession, selectSession,       |
|                   |                                  | mode, setMode, selectedModel, setSelectedModel,    |
|                   |                                  | selectedFeatures, setSelectedFeatures,             |
|                   |                                  | features, featuresLoading, featuresError,          |
|                   |                                  | models, user, onLogout, isOpen, onClose.           |
|                   |                                  | Responsive drawer (mobile) / fixed sidebar.        |
|                   |                                  | Contains: session list (CRUD), workspace modes,    |
|                   |                                  | agent capability checkboxes, model picker          |
|                   |                                  | (grouped by provider), settings link, user info    |
|                   |                                  | with logout button.                                |
+-------------------+----------------------------------+----------------------------------------------------+
| MessageList       | components/MessageList.tsx        | messages: Message[], isLoading: boolean            |
|                   |                                  | Auto-scroll: only when user near bottom;           |
|                   |                                  | floating "New messages below" button when scrolled.|
|                   |                                  | Forces immediate scroll to bottom when user sends  |
|                   |                                  | a new message.                                     |
+-------------------+----------------------------------+----------------------------------------------------+
| MessageItem       | components/MessageItem.tsx        | msg: Message, isLast: boolean, isLoading: boolean  |
|                   |                                  | Collapses thought steps by default for completed   |
|                   |                                  | messages, while keeping them open for the active   |
|                   |                                  | streaming response. Renders step variants:         |
|                   |                                  | reasoning, tool_call, tool_result, todo,           |
|                   |                                  | subagent_call/result, file_operation, swarm_status,|
|                   |                                  | tool_skip, state_change. Shows streaming indicator |
|                   |                                  | (spinner + "Receiving...") when msg.status='streaming'|
|                   |                                  | and interrupted warning (AlertTriangle) when       |
|                   |                                  | msg.status='interrupted'.                          |
+-------------------+----------------------------------+----------------------------------------------------+
| ChatInput         | components/ChatInput.tsx          | onSend: (msg: string) => void, isLoading: boolean  |
|                   |                                  | Uses an auto-growing textarea supporting Enter to  |
|                   |                                  | submit and Shift+Enter for newlines.               |
+-------------------+----------------------------------+----------------------------------------------------+
| AgentProgress     | components/AgentProgress.tsx      | progress: AgentProgress | null,                  |
|                   |                                  | state?: AgentState                                 |
|                   |                                  | Animated progress bar with iteration counter,      |
|                   |                                  | swarm URL details (expandable), status message.    |
+-------------------+----------------------------------+----------------------------------------------------+
| AgentStatusBadge  | components/AgentStatusBadge.tsx   | state?: AgentState, className?: string             |
|                   |                                  | Reads from chatStore if state not passed.          |
|                   |                                  | Renders colored pill: starting, running, looping,  |
|                   |                                  | stalled, degraded, completed, aborted.             |
+-------------------+----------------------------------+----------------------------------------------------+
| ToolCallTimeline  | components/ToolCallTimeline.tsx   | steps: ThoughtStep[]                               |
|                   |                                  | Collapsible list of tool_call/tool_skip/           |
|                   |                                  | tool_result steps. Auto-collapsed when > 3 steps.  |
+-------------------+----------------------------------+----------------------------------------------------+
| DegradationToast  | components/DegradationToast.tsx   | Reads agentState from chatStore internally.        |
|                   |                                  | Fixed toast notification when degraded, auto-      |
|                   |                                  | dismiss after 8 seconds.                           |
+-------------------+----------------------------------+----------------------------------------------------+

### Hooks & Services

+--------------+---------------------------+---------------------------------------------------+
| Export       | File                      | Purpose                                           |
+--------------+---------------------------+---------------------------------------------------+
| useChatStream | hooks/useChatStream.ts   | Core SSE stream hook — signature:                 |
|              |                           | { isLoading, sendMessage, stopStream,             |
|              |                           |   recoverMission(missionId), clearMessages }      |
|              |                           | Manages messages state via Zustand store, SSE     |
|              |                           | streaming, agent progress tracking,               |
|              |                           | AbortController per request, history includes     |
|              |                           | current message. Dispatches via                   |
|              |                           | services/applyStreamPacket.ts. recoverMission     |
|              |                           | re-attaches to the Redis mission log stream       |
|              |                           | (cursor-based replay + live tail).                |
+--------------+---------------------------+---------------------------------------------------+
| useChatPage  | hooks/useChatPage.ts      | Orchestrator hook that composes useChatStore,     |
|              |                           | useSessions, useModels, useFeatures, useAuth,     |
|              |                           | useSettingsStore, and useChatStream.              |
|              |                           | Returns aggregated state + actions for ChatPage.  |
|              |                           | Initializes default model/mode/features from      |
|              |                           | settings, loads sessions on auth, wires up        |
|              |                           | sendMessage/clearMessages from useChatStream.     |
+--------------+---------------------------+---------------------------------------------------+
| useFeatures  | hooks/useFeatures.ts      | Fetches available agent capabilities via          |
|              |                           | TanStack Query from /features endpoint.           |
|              |                           | Returns { features: AgentFeature[], isLoading,    |
|              |                           |   isError }                                       |
+--------------+---------------------------+---------------------------------------------------+
| useModels    | hooks/useModels.ts        | Wraps TanStack Query for model list via           |
|              |                           | modelQueries.list().                              |
|              |                           | Returns { models, isLoading, ...query }            |
+--------------+---------------------------+---------------------------------------------------+
| useSessions  | hooks/useSessions.ts      | Session CRUD helpers using sessionApi.            |
|              |                           | Returns { sessions, activeSessionId,              |
|              |                           |   createSession, deleteSession, selectSession }.  |
|              |                           | Data fetching moved to useChatPage via useQuery.  |
|              |                           | selectSession only sets activeSessionId; messages |
|              |                           | fetch automatically via RQ key change.            |
+--------------+---------------------------+---------------------------------------------------+
| useSkills    | hooks/useSkills.ts        | Fetches available skills via TanStack Query from  |
|              |                           | /skills endpoint.                                 |
|              |                           | Returns { skills: AgentSkill[], isLoading }       |
+--------------+---------------------------+---------------------------------------------------+
| sessionApi   | services/chat-api.ts      | Service methods for session CRUD:                 |
|              |                           | list(), create(title?), get(id),                  |
|              |                           | getMessages(id), delete(id)                       |
|              |                           | Uses api client + SESSION_ENDPOINTS constants.    |
+--------------+---------------------------+---------------------------------------------------+

### Zustand Store (`stores/chatStore.ts`)

+-------------------+------------+---------------------------------------------------+
| State             | Type       | Description                                       |
+-------------------+------------+---------------------------------------------------+
| messages          | Message[]  | Current conversation messages                     |
| isLoading         | boolean    | Whether a stream request is in flight             |
| agentProgress     | AgentProgress | null | Current agent iteration/swarm progress        |
| sessions          | Session[]  | List of user sessions                             |
| activeSessionId   | string | null | Currently selected session ID                  |
| agentState        | AgentState | Current agent FSM state (starting/running/...)    |
+-------------------+------------+---------------------------------------------------+

+-----------------+------------------------------+-----------------------------------------+
| Setter          | Signature                    | Description                             |
+-----------------+------------------------------+-----------------------------------------+
| setMessages     | (updater: Message[] | func)  | Replace or derive messages              |
| setIsLoading    | (loading: boolean)           | Set streaming flag                      |
| setAgentProgress| (updater: ... | null | func) | Replace or derive agent progress        |
| setSessions     | (sessions: Session[])        | Replace session list                    |
| setActiveSession| (id: string | null)         | Set active session ID                   |
| setAgentState   | (state: AgentState)          | Set agent FSM state                     |
| clearMessages   | ()                           | Reset messages, isLoading, progress     |
+-----------------+------------------------------+-----------------------------------------+

### Types (`types/index.ts`)

+----------------+-------------------------------------------+-----------------------------------+
| Type           | Key fields                                | Purpose                            |
+----------------+-------------------------------------------+-----------------------------------+
| Message        | role, content, steps, meta?, usage?, id, | UI message with thought steps      |
|                | status?                                | status: streaming/complete/interrupted |
+----------------+-------------------------------------------+-----------------------------------+
| ThoughtStep    | type, content?, toolName?, toolInput?,    | Individual thought step in         |
|                | todos?, subagent?, fileOp?, swarm?        | assistant message                  |
+----------------+-------------------------------------------+-----------------------------------+
| ChatMode       | 'standard' | 'agent' | 'nlah'               | Chat mode discriminator            |
+----------------+-------------------------------------------+-----------------------------------+
| Session        | id, title, createdAt, updatedAt,          | User session metadata              |
|                | messageCount, contextSummary?             |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| AgentState     | 'starting' | 'running' | 'looping' |       | Agent FSM state                    |
|                | 'stalled' | 'degraded' | 'completed' |     |                                    |
|                | 'aborted'                                |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| AgentStatus    | state, step, throughput,                  | Detailed agent status from SSE     |
|                | activeBreakers, currentTool?, thought?    |                                    |
|                | lastActivity                              |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| AgentProgress  | state?, agentStatus?, iteration,          | Consolidated progress for          |
|                | totalIterations, currentTool?,            | AgentProgress component            |
|                | statusMessage?, swarm?                   |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| StreamPacket   | type, missionId, step, seq, timestamp,    | Raw SSE packet (19 types)          |
|                | agentStatus?, content?, toolName?,        | Discriminated union — shape         |
|                | toolInput?, toolResult?, todos?,          | varies by type (flat, no meta).     |
|                | subagent?, swarm?, usage?, from?, to?,   | Includes `replay_done`, a synthetic |
|                | reason?, phase?, completed?,              | marker emitted by the stream (not   |
|                | totalIterations?, totalCost?             | by the harness)                     |
+----------------+-------------------------------------------+-----------------------------------+
| MissionMeta    | missionId?, strategy?, historyDepth?,     | Mission metadata from metadata     |
|                | toolsAvailable?, objective?,              | packet (flat fields)               |
|                | maxIterations?                           |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| TokenUsage     | promptTokens, completionTokens,           | Token consumption stats            |
|                | totalTokens, reasoningTokens?            |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| HistoryMessage | role, content                             | Lightweight history entry          |
+----------------+-------------------------------------------+-----------------------------------+
| DbMessage      | id, session_id, role, content,            | Raw DB message row with status     |
|                | token_count, turn_number, status?,        | streaming/complete/interrupted      |
|                | created_at                                |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| FailedUrl      | url, reason                               | Failed scrape URL entry            |
+----------------+-------------------------------------------+-----------------------------------+

### Constants (`constants.ts`)

+----------------+---------------------------------------------------------------------+
| Constant       | Value / Contents                                                    |
+----------------+---------------------------------------------------------------------+
| CHAT_ROLES     | { USER: "user", ASSISTANT: "assistant" }                            |
+----------------+---------------------------------------------------------------------+
| CHAT_MODES     | { STANDARD: "standard", AGENT: "agent" }                            |
+----------------+---------------------------------------------------------------------+
| PACKET_TYPES   | 19 types: metadata, usage, content, reasoning, tool_call,           |
|                | tool_result, todo, subagent_call, subagent_result,                  |
|                | file_operation, swarm_status, tool_skip, heartbeat,                 |
|                | state_change, degraded, progress, turn_complete, error,             |
|                | replay_done (synthetic stream marker, never emitted by the harness) |
+----------------+---------------------------------------------------------------------+
| CHAT_ENDPOINTS | { STREAM: "/chat/stream" }                                          |
+----------------+---------------------------------------------------------------------+
| SESSION_ENDPOINTS | { LIST, CREATE, GET, MESSAGES, DELETE, GENERATE_TITLE }         |
+----------------+---------------------------------------------------------------------+
| STORAGE_KEYS   | { ACTIVE_SESSION: "echo_active_session" }                           |
+----------------+---------------------------------------------------------------------+

## Dependencies

### Internal

- `@/lib/api-client` — `api.stream()`, `api.get()`, `api.post()`, `api.delete()`
- `@/lib/queries` — `modelQueries`
- `@/utils/cn` — classname merging
- `@/constants` — `UI_CONFIG`
- `@/components/Markdown` — markdown renderer
- `@/features/auth/hooks/useAuth` — authentication state
- `@/features/settings/stores/settingsStore` — user settings (default model, mode, features)

### External

- `zustand` — state management (chatStore)
- `@tanstack/react-query` — server state (features, models, skills)
- `lucide-react` — icons
- `framer-motion` — animations (AnimatePresence, motion)

## Source References

+---------------------------------------------------+-------+----------------------------------------------------+
| File                                              | Lines | Description                                        |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/types/index.ts                  | 1–208 | All chat types: Message, StreamPacket, ThoughtStep,|
|                                                   |       | AgentProgress, MissionMeta, TokenUsage, Session,   |
|                                                   |       | AgentState, AgentStatus, TurnComplete,              |
|                                                   |       | HistoryMessage, DbMessage, FailedUrl, ChatMode     |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/constants.ts                    | 1–50  | CHAT_ROLES, CHAT_MODES, PACKET_TYPES (17 types),   |
|                                                   |       | CHAT_ENDPOINTS, SESSION_ENDPOINTS, STORAGE_KEYS    |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/stores/chatStore.ts             | 1–40  | Zustand store — messages, isLoading, agentProgress,|
|                                                   |       | sessions, activeSessionId, agentState + 7 setters  |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useChatStream.ts          | 1–307 | Core SSE stream hook — AbortController, history    |
|                                                   |       | includes current message, clear crash guard,       |
|                                                   |       | handles all 17 packet types                        |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useChatPage.ts            | 1–125 | Orchestrator hook — useQuery for sessions +        |
|                                                   |       | messages, composes store, models, features, auth,  |
|                                                   |       | settings, useChatStream. Dedup by React Query key. |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useSessions.ts            | 1–100 | Session CRUD helpers (create, delete, select).     |
|                                                   |       | Data fetching delegated to useChatPage's useQuery. |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useFeatures.ts            | 1–28  | TanStack Query wrapper for /features endpoint      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useModels.ts              | 1–12  | TanStack Query wrapper for model list via          |
|                                                   |       | modelQueries                                       |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useSkills.ts              | 1–23  | TanStack Query wrapper for /skills endpoint        |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/services/chat-api.ts            | 1–23  | sessionApi service: list, create, get, getMessages,|
|                                                   |       | delete                                             |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/ChatPage.tsx         | 1–146 | Orchestrator with header, sidebar, message list,   |
|                                                   |       | tool call timeline, progress, input, toast         |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/SessionSidebar.tsx   | 1–334 | Session list (CRUD), mode toggle, capabilities,    |
|                                                   |       | model picker grouped by provider, user+logout      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/ChatInput.tsx        | 12–88 | Input form with send button and loading state      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/MessageList.tsx      | 1–108 | Scrollable message list with near-bottom detection,|
|                                                   |       | floating "New messages below" button               |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/MessageItem.tsx      | 1–359 | Renders message content + 10 thought step variants |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/AgentProgress.tsx    | 1–199 | Animated progress bar with swarm URL details       |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/AgentStatusBadge.tsx | 1–37  | Colored pill for agent FSM state                   |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/ToolCallTimeline.tsx | 1–72  | Collapsible tool call list filter from steps       |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/DegradationToast.tsx | 1–44  | Fixed toast on degraded state, auto-dismiss 8s     |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/index.ts                        | 1–14  | Barrel exports: components, hooks, types            |
+---------------------------------------------------+-------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
