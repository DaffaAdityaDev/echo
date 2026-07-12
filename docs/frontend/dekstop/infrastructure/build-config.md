================================================================================
  Build Configuration
================================================================================
  Module    : Build Configuration
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The application is built with `electron-vite` (a Vite-based build tool for Electron) and packaged with `electron-builder`. The build configuration is split across three concerns: Vite bundling per process (main, preload, renderer), electron-builder packaging per platform, and TypeScript compilation checks.

## File Structure

```
frontend/dekstop/
├── electron.vite.config.ts       # Vite config for main/preload/renderer
├── electron-builder.yml          # electron-builder packaging config
├── tsconfig.json                 # Root TS config
├── tsconfig.node.json            # Node (main + preload) TS config
├── tsconfig.web.json             # Renderer (browser) TS config
└── package.json                  # Scripts and build commands
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           npm run dev                               │
│                              │                                     │
│                              v                                     │
│              ┌───────────────────────────────┐                     │
│              │    electron-vite dev          │                     │
│              │  HMR for main, preload,       │                     │
│              │  renderer                     │                     │
│              └───────────────────────────────┘                     │
│                                                                     │
│                           npm run build                            │
│                              │                                     │
│                              v                                     │
│              ┌───────────────────────────────┐                     │
│              │   npm run typecheck           │                     │
│              │   tsc --noEmit (node + web)   │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │   electron-vite build         │                     │
│              │   ┌─────────────────────────┐ │                     │
│              │   │ main → out/main/index.js│ │                     │
│              │   │ preload → out/preload/  │ │                     │
│              │   │          index.js        │ │                     │
│              │   │ renderer → out/renderer/│ │                     │
│              │   │            index.html   │ │                     │
│              │   └─────────────────────────┘ │                     │
│              └──────────────┬────────────────┘                     │
│                             v                                     │
│              ┌───────────────────────────────┐                     │
│              │   electron-builder            │                     │
│              │   ──win / ──mac / ──linux     │                     │
│              │   Packages installers         │                     │
│              └───────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Entry Points

- **Vite config**: `electron.vite.config.ts`
- **Builder config**: `electron-builder.yml`
- **Build scripts**: `package.json:14-21`

## Dependencies

+-----------------------+-----------+-----------------------------------------------+
| Package               | Version   | Purpose                                       |
+-----------------------+-----------+-----------------------------------------------+
| electron-vite         | ^2.3.0    | Vite-based Electron build tool                |
+-----------------------+-----------+-----------------------------------------------+
| electron-builder      | ^25.1.8   | Installer packaging                           |
+-----------------------+-----------+-----------------------------------------------+
| vite                  | ^5.0.0    | Underlying bundler                            |
+-----------------------+-----------+-----------------------------------------------+
| @vitejs/plugin-react  | ^4.3.4    | React Fast Refresh                            |
+-----------------------+-----------+-----------------------------------------------+
| @tailwindcss/vite     | ^4.0.0    | Tailwind v4 Vite plugin                       |
+-----------------------+-----------+-----------------------------------------------+

## Configuration Details

### 1. `electron.vite.config.ts` (Vite per Process)

```
src/../../../electron.vite.config.ts
```

```typescript
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]   // Node externals for main
  },
  preload: {
    plugins: [externalizeDepsPlugin()]   // Node externals for preload
  },
  renderer: {
    resolve: {
      alias: { '@renderer': resolve('src/renderer/src') }
    },
    plugins: [react(), tailwindcss()]     // React + Tailwind for renderer
  }
})
```

- **main**: Node.js target, externalizes dependencies
- **preload**: Node.js target, externalizes dependencies
- **renderer**: Browser target, uses `@renderer` path alias

### 2. `electron-builder.yml` (Packaging)

```
electron-builder.yml
```

+-------------+----------------------------------------------------------+
| Section     | Details                                                  |
+-------------+----------------------------------------------------------+
| appId       | com.electron.app                                         |
+-------------+----------------------------------------------------------+
| files       | Excludes source, config, and dev files from ASAR         |
+-------------+----------------------------------------------------------+
| asarUnpack  | resources/**                                             |
+-------------+----------------------------------------------------------+
| win         | nsis installer, echo.exe                                 |
+-------------+----------------------------------------------------------+
| mac         | dmg, entitlements (camera, mic, docs)                    |
+-------------+----------------------------------------------------------+
| linux       | AppImage, snap, deb                                      |
+-------------+----------------------------------------------------------+
| publish     | Generic provider: https://example.com/auto-updates       |
+-------------+----------------------------------------------------------+

### 3. Build Scripts (`package.json`)

+--------------+------------------------------------------+------------------------------------------+
| Script       | Command                                  | Purpose                                  |
+--------------+------------------------------------------+------------------------------------------+
| dev          | electron-vite dev                        | Development with HMR                     |
+--------------+------------------------------------------+------------------------------------------+
| start        | electron-vite preview                    | Preview built app                        |
+--------------+------------------------------------------+------------------------------------------+
| build        | typecheck && electron-vite build         | Production build                         |
+--------------+------------------------------------------+------------------------------------------+
| build:win    | build && electron-builder --win          | Windows installer                        |
+--------------+------------------------------------------+------------------------------------------+
| build:mac    | electron-vite build && electron-builder  | macOS DMG (skips typecheck)             |
|              | --mac                                    |                                          |
+--------------+------------------------------------------+------------------------------------------+
| build:linux  | electron-vite build && electron-builder  | Linux AppImage/deb/snap (skips           |
|              | --linux                                  | typecheck)                               |
+--------------+------------------------------------------+------------------------------------------+
| build:unpack | build && electron-builder --dir          | Unpacked directory                       |
+--------------+------------------------------------------+------------------------------------------+

### 4. TypeScript Configs

+---------------------+---------------------------+---------------------------------------------+
| Config              | Applies to                | Role                                        |
+---------------------+---------------------------+---------------------------------------------+
| tsconfig.node.json  | src/main/, src/preload/   | Node.js environment types                   |
+---------------------+---------------------------+---------------------------------------------+
| tsconfig.web.json   | src/renderer/             | Browser/DOM environment types               |
+---------------------+---------------------------+---------------------------------------------+
| tsconfig.json       | Root                      | Project references                          |
+---------------------+---------------------------+---------------------------------------------+

## Source Refs

+-----------------------------+---------------------------------------------------+
| File                        | Role                                              |
+-----------------------------+---------------------------------------------------+
| electron.vite.config.ts     | Vite bundling per process                         |
+-----------------------------+---------------------------------------------------+
| electron-builder.yml        | electron-builder packaging                        |
+-----------------------------+---------------------------------------------------+
| package.json:14-21          | Build/dev scripts                                 |
+-----------------------------+---------------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
