================================================================================
  Electron Lifecycle (Main Process)
================================================================================
  Module    : Electron Lifecycle
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The main process entry point (`src/main/index.ts`) bootstraps the Electron application: it creates the `BrowserWindow`, registers IPC handlers, configures dev shortcuts, and manages the application lifecycle events (ready, activate, window-all-closed). The application uses `electron-vite` for HMR and builds.

## File Structure

```
src/main/index.ts
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        app.whenReady()                             │
│                              │                                     │
│                              v                                     │
│              ┌───────────────────────────────┐                     │
│              │     setAppUserModelId         │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │   optimizer setup             │                     │
│              │   (F12 toggle DevTools,       │                     │
│              │    Cmd+R disabled in prod)    │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │    ipcMain.on(ping)           │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │        createWindow()         │                     │
│              │  ┌─────────────────────────┐  │                     │
│              │  │  - 900x670              │  │                     │
│              │  │  - preload              │  │                     │
│              │  │  - loadURL/file         │  │                     │
│              │  └─────────────────────────┘  │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │   app.on(activate)            │                     │
│              │   (macOS dock click →         │                     │
│              │    recreate window)           │                     │
│              └───────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

+--------------+-------------------------+----------------------------------------------------+
| Entry        | Source                  | Description                                        |
+--------------+-------------------------+----------------------------------------------------+
| Main binary  | package.json:5          | "main": "./out/main/index.js"                      |
+--------------+-------------------------+----------------------------------------------------+
| Source entry | src/main/index.ts       | TypeScript main process entry                      |
+--------------+-------------------------+----------------------------------------------------+

## Dependencies

+---------------------------+------------------------------------------------------+
| Package                   | Purpose                                              |
+---------------------------+------------------------------------------------------+
| electron                  | app, BrowserWindow, shell, ipcMain                   |
+---------------------------+------------------------------------------------------+
| @electron-toolkit/utils   | electronApp.setAppUserModelId, optimizer.watch-      |
|                           | WindowShortcuts, is.dev                              |
+---------------------------+------------------------------------------------------+

## Lifecycle Details

### 1. Window Creation (`createWindow()`, lines 6-36)

```
src/main/index.ts:6-36
```

- `width: 900`, `height: 670`
- `show: false` → window appears only after `ready-to-show` event (prevents white flash)
- `autoHideMenuBar: true`
- `webPreferences.preload` points to compiled preload script
- `sandbox: false` (preload needs Node.js access)

### 2. Dev vs Production Loading (lines 31-35)

```typescript
if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
} else {
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}
```

- In development: loads from `electron-vite` dev server URL (HMR enabled)
- In production: loads the built `index.html` from the renderer output directory

### 3. Security (line 24-27)

```typescript
mainWindow.webContents.setWindowOpenHandler((details) => {
  shell.openExternal(details.url)
  return { action: 'deny' }
})
```

- All `window.open()` calls from the renderer open in the default browser
- The Electron window never navigates to external URLs

### 4. Application Events

+----------------------+-----------+---------------------------------------------------+
| Event                | Handler   | Behavior                                          |
+----------------------+-----------+---------------------------------------------------+
| app.whenReady()      | line 41   | Bootstrap sequence: model ID, optimizer, IPC,     |
|                      |           | window                                            |
+----------------------+-----------+---------------------------------------------------+
| browser-window-      | line 48   | optimizer.watchWindowShortcuts (F12 devtools,     |
| created              |           | disable Cmd+R in prod)                            |
+----------------------+-----------+---------------------------------------------------+
| activate             | line 57   | macOS: recreate window if none exist              |
+----------------------+-----------+---------------------------------------------------+
| window-all-closed    | line 67   | Quit on non-macOS platforms                       |
+----------------------+-----------+---------------------------------------------------+

### 5. IPC Handlers (line 53)

```typescript
ipcMain.on('ping', () => console.log('pong'))
```

- Single test handler, can be extended for custom channels

## Source Refs

+-------------------------+----------------------+----------------------------------------------------+
| File                    | Lines                | Description                                        |
+-------------------------+----------------------+----------------------------------------------------+
| src/main/index.ts       | 6-36                 | BrowserWindow setup (createWindow())               |
+-------------------------+----------------------+----------------------------------------------------+
| src/main/index.ts       | 41-62                | Bootstrap lifecycle (app.whenReady())              |
+-------------------------+----------------------+----------------------------------------------------+
| src/main/index.ts       | 67-71                | Platform quit logic (window-all-closed)            |
+-------------------------+----------------------+----------------------------------------------------+
| package.json            | 5                    | Electron main entry path ("main")                  |
+-------------------------+----------------------+----------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
