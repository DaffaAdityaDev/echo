================================================================================
  Chat Feature
================================================================================
  Module    : Chat Feature
  Service   : Web
  Version   : 1.4
  Updated   : 2026-08-07 (minimal {message, sessionId} payload; session id via X-Session-ID; config via global settings)
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
│   ├── ChatPage.tsx            (thin orchestrator)
│   ├── DegradationToast.tsx
│   ├── MessageItem.tsx
│   ├── MessageList.tsx
│   ├── SessionSidebar.tsx      (shell)
│   ├── ToolCallTimeline.tsx
│   ├── chat-page/              (ChatPage sub-parts)
│   │   ├── ChatHeader.tsx
│   │   ├── MissionInfoBar.tsx
│   │   └── WelcomeHero.tsx
│   ├── debug/                  (DebugDrawer 4-tab drawer)
│   │   ├── DebugDrawer.tsx     (shell + tab nav)
│   │   ├── PacketLogsPanel.tsx
│   │   ├── PromptInspectorPanel.tsx
│   │   ├── UsageMetricsPanel.tsx
│   │   ├── StoreStatePanel.tsx
│   │   └── index.ts
│   ├── sidebar/                (SessionSidebar sub-parts)
│   │   ├── SessionList.tsx
│   │   └── SessionListItem.tsx
│   └── steps/                  (MessageItem thought-step renders)
│       ├── ThoughtStepView.tsx (dispatcher)
│       ├── ReasoningStep.tsx
│       ├── ToolCallStep.tsx
│       ├── ToolResultStep.tsx
│       ├── TodosStep.tsx
│       ├── SubagentStep.tsx
│       └── index.ts
├── services/
│   ├── chat-api.ts
│   └── stream/                 (SSE packet dispatcher)
│       ├── index.ts            (applyStreamPacket entry)
│       └── handlers/
│           ├── steps.ts        (reasoning, tool_call, tool_result, todo, subagent, ...)
│           ├── status.ts       (turn_complete, error, mission_completed, heartbeat, progress)
│           ├── metrics.ts      (usage, token_metrics)
│           └── misc.ts         (metadata, debug, system_notice, hitl, content delta)
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
 │   │ empty assistantMsg   │   │   POST /chat/stream,             │           │
 │   │ to store              │   │   { message, sessionId },        │           │
 │   │                       │   │   onChunk, { signal }           │           │
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

### Chat Request Payload & Session Semantics

`sendMessage` posts a minimal payload — no model, mode, features, skills,
config, history, or strategyVersion fields:

```json
{ "message": "string (required)", "sessionId": "string (optional)" }
```

- No `sessionId` → the gateway creates a new session (this message is
  turn 1); the new session id is read from the **`X-Session-ID`** response
  header of the SSE stream response. **New Chat is lazy** — the frontend
  never pre-creates sessions; the backend creates them on first message.
- With `sessionId` → the message appends to that session (append-only,
  never replace). History is always loaded server-side from the session's
  DB messages.
- All config (model, mode, features, skills, harness toggles) is resolved
  server-side per request from the user's global settings
  (`user_preferences`, GET/PUT `/api/v1/settings`). The chat store no
  longer holds model/mode/features — the model selector, mode toggle, and
  web_search toggle now read and write the global settings (PUT
  `/api/v1/settings`).
- Agent SSE packets still carry `missionId` — the mission id remains the
  internal run id, unrelated to the session id.

### Session Recovery After Refresh

A refresh mid-run never resumes the mission: the agent cancels missions on
disconnect (token safety). The DB snapshot is the recovery path — messages
rebuild from `GET /sessions/{id}/messages`:

- Partial content is preserved (the gateway flushes content to the DB every
  2s during streaming and finalizes the turn — `complete` on `turn_complete`,
  `interrupted` otherwise).
- An `error` packet carrying "Mission cancelled by client disconnect" is
  surfaced as an **interrupted** turn (badge "send a reply to continue"), not
  as a completed error — continue the conversation with a new message.

## Session List & Cache Behavior (Standard)

Perilaku standar (lihat juga `tanstack-query-setup.md` dan `ui-components.md`):

1. **Membuka modal / drawer TIDAK pernah menghapus state atau list.**
   Modal (settings, model selector, help) hanyalah `useState` lokal di
   `ChatPage`; tidak ada satu pun yang menyentuh `chatStore` atau cache
   `["sessions"]`. List sidebar dirender dari **React Query cache**
   (`useSessionsInfinite` → `flattenedSessions`), bukan dari `chatStore`
   (store hanya mirror untuk aksi CRUD & auto-select).

2. **Cache tidak pernah di-drop saat refetch gagal.** React Query v5 membuang
   `data` ketika refetch error (perubahan breaking dari v4) — tanpa
   `placeholderData: keepPreviousData`, satu kegagalan refetch membuat list
   tampil kosong ("No recent chats") **menetap** sampai halaman di-refresh.
   Semua query list memakai `QUERY_STANDARD` (`src/lib/query-standard.ts`):
   `placeholderData: keepPreviousData`, `retry: 1`,
   `refetchOnWindowFocus: false`. Query yang queryKey-nya berubah per seleksi
   (messages per session, prompt versions per template) menimpa
   `placeholderData` dengan fungsi yang dibatasi key sebelumnya — pindah
   session/template = clean slate, tidak menampilkan data milik entitas lain.

3. **`/auth/me` memakai `staleTime: 5 menit`** — mounting komponen baru yang
   memakai `useAuth` (mis. membuka SettingsModal) tidak lagi memicu refetch
   auth; mencegah flip `isAuthenticated` yang mematikan-nyalakan
   `enabled` query sessions (pemicu refetch tak terduga). Kedaluwarsa tetap
   ditangani oleh interceptor 401 di `api-client.ts` (redirect ke `/login`).

4. **UI tiga-state (loading / error / empty).** Empty state ("No recent chats",
   "No messages") hanya dirender saat query **sukses dan benar-benar kosong**:
   - query pending tanpa data → "Loading chats..."
   - query error tanpa data → pesan error + tombol Retry (`refetch`)
   - query error dengan data (placeholder) → banner "Failed to refresh" + Retry,
     list lama tetap tampil
   - sukses & kosong → "No recent chats" / WelcomeHero

   Referensi implementasi: `SessionList.tsx`, `ChatPage.tsx` (messages error
   state + banner), `PromptLibrary.tsx`.

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
| DebugDrawer   | Component   | components/debug/DebugDrawer.tsx         |
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
|                   |                                  | streaming response. Step variants render via       |
|                   |                                  | components/steps/ThoughtStepView.tsx (reasoning,   |
|                   |                                  | tool_call, tool_result, todo, subagent_call/       |
|                   |                                  | result, file_operation, swarm_status, tool_skip,   |
|                   |                                  | state_change). Shows streaming indicator           |
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
| useChatStream | hooks/useChatStream.ts   | Core SSE stream hook — signature:              |
|              |                           | { isLoading, sendMessage, stopStream,          |
|              |                           |   clearMessages }                              |
|              |                           | Manages messages state via Zustand store, SSE  |
|              |                           | streaming, agent progress tracking,            |
|              |                           | AbortController per request. Payload is        |
|              |                           | { message, sessionId } — history is loaded     |
|              |                           | server-side; a new session's id is read from   |
|              |                           | the X-Session-ID response header. Dispatches   |
|              |                           | via services/stream/index.ts.                  |
+--------------+---------------------------+---------------------------------------------------+
| useChatPage  | hooks/useChatPage.ts      | Orchestrator hook that composes useChatStore,     |
|              |                           | useSessions, useModels, useFeatures, useAuth,    |
|              |                           | useSettingsStore, and useChatStream.             |
|              |                           | Returns aggregated state + actions for ChatPage. |
|              |                           | Reads model/mode/features from global settings   |
|              |                           | (GET /settings); selector/toggle changes write   |
|              |                           | back via PUT /settings, loads sessions on auth,  |
|              |                           | wires up sendMessage/clearMessages from          |
|              |                           | useChatStream.                                   |
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
| StreamPacket   | type, missionId, step, seq, timestamp,    | Raw SSE packet (18 types)          |
|                | agentStatus?, content?, toolName?,        | Discriminated union — shape         |
|                | toolInput?, toolResult?, todos?,          | varies by type (flat, no meta).     |
|                | subagent?, swarm?, usage?, from?, to?,   |                                    |
|                | reason?, phase?, completed?,              |                                    |
|                | totalIterations?, totalCost?             |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| MissionMeta    | strategy?, historyDepth?,                 | Mission metadata from metadata     |
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
| PACKET_TYPES   | 18 types: metadata, usage, content, reasoning, tool_call,           |
|                | tool_result, todo, subagent_call, subagent_result,                  |
|                | file_operation, swarm_status, tool_skip, heartbeat,                 |
|                | state_change, degraded, progress, turn_complete, error              |
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
| src/features/chat/components/ChatPage.tsx         | 1–463 | Thin orchestrator — composes chat-page/ChatHeader, |
|                                                   |       | MissionInfoBar, WelcomeHero (or MessageList),      |
|                                                   |       | ToolCallTimeline, AgentProgress, ChatInput, debug  |
|                                                   |       | drawer, modals, toast. Holds modal/drawer state.   |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/chat-page/ChatHeader.tsx | 1–80 | Header bar: sidebar toggle, model selector, debug, |
|                                                   |       | settings, new chat, share, export, admin link      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/chat-page/WelcomeHero.tsx | 1–95 | Empty-state hero: orb, greeting, ChatInput, prompt |
|                                                   |       | suggestion cards, footer                           |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/SessionSidebar.tsx   | 1–376 | Sidebar shell — nav, search, create button, user   |
|                                                   |       | footer, infinite-query sessions + SessionList      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/sidebar/SessionList.tsx | 1–80 | Grouped Today/Recent session list + load-more      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/sidebar/SessionListItem.tsx | 1–40 | Session row with delete button                     |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/ChatInput.tsx        | 12–88 | Input form with send button and loading state      |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/MessageList.tsx      | 1–108 | Scrollable message list with near-bottom detection,|
|                                                   |       | floating "New messages below" button               |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/MessageItem.tsx      | 1–250 | Renders message card; step variants delegate to    |
|                                                   |       | components/steps/ThoughtStepView.tsx               |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/steps/ThoughtStepView.tsx | 1–40 | Step dispatcher (reasoning/tool_call/tool_result/  |
|                                                   |       | todo/subagent)                                    |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/debug/DebugDrawer.tsx | 1–180 | 4-tab telemetry drawer shell (header + tab nav)    |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/debug/PacketLogsPanel.tsx | 1–180 | Packet feed with filters, expand, copy, export     |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/debug/PromptInspectorPanel.tsx | 1–164 | System prompt + message history inspector         |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/debug/UsageMetricsPanel.tsx | 1–160 | Token/cache/cost metrics + progress bars           |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/components/debug/StoreStatePanel.tsx | 1–90 | Zustand snapshot + packet buffer limit            |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/services/stream/index.ts        | 1–90 | applyStreamPacket entry — builds lastMessage,      |
|                                                   |       | routes by type to handlers/, writes back to store  |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/services/stream/handlers/*.ts    | 1–120 | Per-packet-group handlers (steps/status/metrics/   |
|                                                   |       | misc)                                             |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/components/ui/CopyButton.tsx                  | 1–45 | Shared copy-with-feedback button (used by debug    |
|                                                   |       | panels)                                           |
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
