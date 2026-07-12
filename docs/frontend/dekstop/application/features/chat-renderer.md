================================================================================
  Chat Renderer
================================================================================
  Module    : Chat Renderer
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The `Chat.tsx` component is the primary user interface for interacting with the Echo AI agent. It manages the message list, model selection dropdown, input form, and communication with the backend API via React Query mutations. The component does NOT communicate with the Electron main process — all data flows directly from the renderer to the Go backend via an Axios HTTP client.

> **Initial greeting** — State awal `messages` berisi greeting "Hello! I am your Echo agent..." (`Chat.tsx:22-28`). Pesan ini langsung tampil saat komponen mount.

## File Structure

```
src/renderer/src/components/Chat.tsx
```

## Flow Diagram

```
┌───────────────────┐       HTTP POST /api/v1/chat       ┌─────────────────┐
│                   │  ──────────────────────────────────→ │                 │
│    Chat.tsx       │       Axios (api.ts)                │   Go Backend    │
│                   │  ←────────────────────────────────── │   (Echo API)    │
│  ┌───────────┐    │       JSON response                  │                 │
│  │ useState  │    │                                      └─────────────────┘
│  │ (messages)│    │                                              ↑
│  │ (input)   │    │       HTTP GET /api/v1/models                │
│  │ (model)   │    │  ─────────────────────────────────────────────┘
│  └───────────┘    │
│                   │       ┌──────────────────┐
│  ┌───────────┐    │       │   Backend        │
│  │ useQuery  │    │  ←─── │ { models: [...] }│
│  │ (models)  │    │       └──────────────────┘
│  └───────────┘    │
│  ┌───────────┐    │
│  │ useMutation│   │
│  │ (send)    │    │
│  └───────────┘    │
└───────────────────┘
```

## Entry Points

- **`Chat()` component** — rendered by `App.tsx` at `src/renderer/src/App.tsx:11`
- **`main.tsx`** bootstraps the React tree with `<QueryClientProvider>` (`src/renderer/src/main.tsx:10-14`)

## Dependencies

+-----------------------+------------------------------------------------------+
| Package               | Purpose                                              |
+-----------------------+------------------------------------------------------+
| @tanstack/react-query | Server state management (model fetching, message     |
|                       | sending)                                             |
+-----------------------+------------------------------------------------------+
| axios                 | HTTP client for backend communication                |
+-----------------------+------------------------------------------------------+
| lucide-react          | Send icon                                            |
+-----------------------+------------------------------------------------------+
| ./ui/button, ./ui/    | Radix-based UI primitives                            |
| card, ./ui/input, ./ui|                                                      |
| /select               |                                                      |
+-----------------------+------------------------------------------------------+
| @renderer/lib/utils   | cn() utility for class merging                       |
+-----------------------+------------------------------------------------------+
| @renderer/lib/api     | Pre-configured Axios instance                        |
+-----------------------+------------------------------------------------------+

## How It Works

### 1. Model Fetching (`useQuery`)

```
src/renderer/src/components/Chat.tsx:33
```

- Query key: `["models"]`
- Calls `api.get("/models")` → resolves to `http://localhost:3000/api/v1/models` (baseURL dari `api.ts:4`)
- BaseURL dapat di-override via environment variable `VITE_API_URL` — jika tidak diset, fallback ke `http://localhost:3000/api/v1`
- Falls back to a default model (`deepseek-r1-distill-llama-8b`) on error

### 2. Model Selection (`useEffect`)

```
src/renderer/src/components/Chat.tsx:49
```

- Sets the first available model as default when models finish loading

### 3. Message Sending (`useMutation`)

```
src/renderer/src/components/Chat.tsx:56
```

- Mutation function: `POST /chat` with `{ message, model }` payload
- On success: appends the agent's reply to the message list
- On error: appends an error card with the error message
- **Console logging** — `console.log("Fetching models...")` di awal fetch (`Chat.tsx:36`), `console.error` saat error (`Chat.tsx:41`) untuk debugging

### 4. UI Composition

- **Card wrapper** (`max-w-2xl`, `h-[600px]`) holds header, scrollable content, and footer
- **Header**: title, description, and `<Select>` dropdown for model
- **Content**: scrollable message list with alternating alignment (user right, agent left)
- **Footer**: input form with text field and send button
- **Loading state**: animated "Thinking..." pulse while mutation is pending

### 5. Type Definitions (local)

```
src/renderer/src/components/Chat.tsx:11-19
```

```typescript
interface Message {
  id: number
  role: "user" | "agent"
  content: string
}

interface Model {
  id: string
}
```

## Source Refs

+---------------------------------------------+-------------------------------------------+
| File                                        | Role                                      |
+---------------------------------------------+-------------------------------------------+
| src/renderer/src/components/Chat.tsx        | Component implementation                  |
+---------------------------------------------+-------------------------------------------+
| src/renderer/src/App.tsx                    | Parent layout, renders <Chat />           |
+---------------------------------------------+-------------------------------------------+
| src/renderer/src/main.tsx                   | React root + QueryClientProvider bootstrap|
+---------------------------------------------+-------------------------------------------+
| src/renderer/src/lib/api.ts                 | Axios instance used for HTTP calls        |
+---------------------------------------------+-------------------------------------------+
| src/renderer/src/lib/utils.ts               | cn() Tailwind class merge utility         |
+---------------------------------------------+-------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
