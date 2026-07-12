================================================================================
  Chat Feature
================================================================================
  Module    : Chat Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The core conversation feature. Manages real-time chat with AI agents via Server-Sent Events (SSE), displays messages with rich thought-process rendering (tool calls, sub-agent delegations, swarm research), and provides a sidebar for session/model/feature/mode selection.

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

## Entry Points & Exports

### Barrel (`src/features/chat/index.ts`)

+-------------+-------------+------------------------------------------+
| Export      | Kind        | Source                                   |
+-------------+-------------+------------------------------------------+
| ChatPage    | Component   | components/ChatPage.tsx                  |
+-------------+-------------+------------------------------------------+
| Message     | Type        | types/index.ts                           |
+-------------+-------------+------------------------------------------+
| useModels   | Hook        | hooks/useModels.ts                       |
+-------------+-------------+------------------------------------------+
| useChatStream | Hook      | hooks/useChatStream.ts                   |
+-------------+-------------+------------------------------------------+
| useSkills   | Hook        | hooks/useSkills.ts                       |
+-------------+-------------+------------------------------------------+

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
|                   |                                  | tool_skip, state_change.                           |
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
|              |                           | (selectedModel, mode, selectedFeatures) →         |
|              |                           | { messages, isLoading, agentProgress,             |
|              |                           |   sendMessage, clearMessages }                    |
|              |                           | Manages messages state via Zustand store, SSE     |
|              |                           | streaming, agent progress tracking,                |
|              |                           | AbortController per request, history includes     |
|              |                           | current message. Handles all 17 packet types      |
|              |                           | (see PACKET_TYPES in constants.ts).               |
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
| useSessions  | hooks/useSessions.ts      | Session CRUD operations using sessionApi.         |
|              |                           | Returns { sessions, activeSessionId,              |
|              |                           |   loadSessions, loadSessionMessages,              |
|              |                           |   createSession, deleteSession, selectSession }   |
|              |                           | Loads/saves messages from DB via dbMessageToMsg.  |
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
| Message        | role, content, steps, meta?, usage?, id  | UI message with thought steps      |
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
| StreamPacket   | type, content?, toolName?, toolInput?,    | Raw SSE packet (17 types)          |
|                | meta?, todos?, subagent?, fileOp?,        |                                    |
|                | swarm?, agentStatus?, turnComplete?,      |                                    |
|                | step?, choices?                           |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| MissionMeta    | missionId?, strategy?, historyDepth?,     | Mission metadata from metadata     |
|                | toolsAvailable?, objective?,              | packet                             |
|                | maxIterations?                           |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| TokenUsage     | promptTokens, completionTokens,           | Token consumption stats            |
|                | totalTokens, reasoningTokens?            |                                    |
+----------------+-------------------------------------------+-----------------------------------+
| TurnComplete   | tokenCount, toolCalls, duration           | Turn completion summary            |
+----------------+-------------------------------------------+-----------------------------------+
| HistoryMessage | role, content                             | Lightweight history entry          |
+----------------+-------------------------------------------+-----------------------------------+
| DbMessage      | id, session_id, role, content,            | Raw DB message row                 |
|                | token_count, turn_number, created_at      |                                    |
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
| PACKET_TYPES   | 17 types: metadata, usage, content, reasoning, tool_call,           |
|                | tool_result, todo, subagent_call, subagent_result,                  |
|                | file_operation, swarm_status, tool_skip, heartbeat,                 |
|                | state_change, degraded, progress, turn_complete                     |
+----------------+---------------------------------------------------------------------+
| CHAT_ENDPOINTS | { STREAM: "/chat/stream" }                                          |
+----------------+---------------------------------------------------------------------+
| SESSION_ENDPOINTS | { LIST: "/sessions", CREATE: "/sessions", GET, MESSAGES, DELETE } |
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
| src/features/chat/hooks/useChatPage.ts            | 1–61  | Orchestrator hook — composes store, sessions,      |
|                                                   |       | models, features, auth, settings, useChatStream    |
+---------------------------------------------------+-------+----------------------------------------------------+
| src/features/chat/hooks/useSessions.ts            | 1–73  | Session CRUD with optimistic delete, DB message    |
|                                                   |       | loading via dbMessageToMessage                     |
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
| src/features/chat/index.ts                        | 1–5   | Barrel exports: ChatPage, Message, useModels,      |
|                                                   |       | useChatStream, useSkills                           |
+---------------------------------------------------+-------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
