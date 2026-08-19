================================================================================
  Electron IPC Pattern (Main ↔ Preload ↔ Renderer)
================================================================================
  Module    : Electron IPC Pattern
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The application follows the standard Electron security model: the **main process** (Node.js) communicates with the **renderer process** (Chromium) exclusively through a **preload script** using `contextBridge`. The preload script acts as a secure bridge, exposing only whitelisted APIs to the renderer.

> **Current status:** The bridge is set up but minimal — only `@electron-toolkit/preload` utilities (`electronAPI`) are exposed. No custom IPC channels are defined yet.

## File Structure

```
src/
├── main/
│   └── index.ts                  # Main process: creates window, listens on IPC
├── preload/
│   ├── index.ts                  # Preload: contextBridge.exposeInMainWorld
│   └── index.d.ts                # Type declarations for Window.electron / Window.api
└── renderer/
    └── src/
        └── components/
            ├── Chat.tsx          # Renderer component (uses Axios, NOT IPC)
```

## Flow Diagram

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌───────────────────────────┐
│     Main Process        │     │     Preload Script      │     │    Renderer Process       │
│    (Node.js)            │     │    (contextBridge)      │     │   (Chromium)              │
│                         │     │                         │     │                           │
│  ┌───────────────────┐  │     │  ┌───────────────────┐  │     │  ┌─────────────────────┐  │
│  │ ipcMain.on(event) │←─┼─────┼──│ ipcRenderer       │←─┼─────┼──│ window.electron     │  │
│  │ BrowserWindow     │  │     │  │ electronAPI       │  │     │  │ window.api          │  │
│  └───────────────────┘  │     │  └───────────────────┘  │     │  └─────────────────────┘  │
└─────────────────────────┘     └─────────────────────────┘     └───────────────────────────┘
         │                                                                         │
         │  contextIsolated: true                                                  │
         │  nodeIntegration: false                                                 │
         └─────────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Main process** — `src/main/index.ts:1`
- **Preload script** — `src/preload/index.ts:1`
- **Preload types** — `src/preload/index.d.ts:1`

## Dependencies

+---------------------------+------------------------------------------------------+
| Package                   | Purpose                                              |
+---------------------------+------------------------------------------------------+
| electron                  | ipcMain, contextBridge, BrowserWindow                |
+---------------------------+------------------------------------------------------+
| @electron-toolkit/preload | Pre-built electronAPI bridge utilities               |
+---------------------------+------------------------------------------------------+
| @electron-toolkit/utils   | electronApp, optimizer, is helpers                   |
+---------------------------+------------------------------------------------------+

## Component Details

### 1. Main Process (`src/main/index.ts`)

```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false
}
```

- `sandbox: false` is required for the preload to access Node.js APIs
- `nodeIntegration` defaults to `false` (secure by default)
- A single IPC test handler is registered: `ipcMain.on('ping', () => console.log('pong'))` at line 53

### 2. Preload Script (`src/preload/index.ts`)

```typescript
import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
}
```

- `electronAPI` exposes safe Electron utilities (clipboard, shell, etc.) from `@electron-toolkit/preload`
- `api` is an empty object — a placeholder for future custom IPC methods
- Also provides a non-contextIsolated fallback (lines 17-21)

### 3. Type Declarations (`src/preload/index.d.ts`)

```typescript
declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}
```

- Augments the global `Window` interface for TypeScript consumption in the renderer

### 4. Renderer (`src/renderer/src/components/Chat.tsx`)

- Chat does NOT use `window.electron` or `window.api`
- All data flows through Axios HTTP directly to the Go backend

## How to Add Custom IPC

To add a new IPC channel:

1. **Main process** — add handler:
   ```typescript
   ipcMain.handle('my-channel', async (_event, arg) => {
     return doSomething(arg)
   })
   ```

2. **Preload** — expose via bridge:
   ```typescript
   const api = {
     myMethod: (arg) => ipcRenderer.invoke('my-channel', arg)
   }
   contextBridge.exposeInMainWorld('api', api)
   ```

3. **Types** — declare in `index.d.ts`:
   ```typescript
   interface Window {
     api: { myMethod: (arg: string) => Promise<Result> }
   }
   ```

4. **Renderer** — call from React:
   ```typescript
   const result = await window.api.myMethod('hello')
   ```

## Source Refs

+----------------------------------------+------------------------------------------------------+
| File                                   | Role                                                 |
+----------------------------------------+------------------------------------------------------+
| src/main/index.ts:14-17                | Preload path and sandbox config in BrowserWindow     |
+----------------------------------------+------------------------------------------------------+
| src/main/index.ts:53                   | Ping IPC handler                                     |
+----------------------------------------+------------------------------------------------------+
| src/preload/index.ts:10-16             | contextBridge.exposeInMainWorld calls                |
+----------------------------------------+------------------------------------------------------+
| src/preload/index.d.ts:3-7             | Window type augmentation                             |
+----------------------------------------+------------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
