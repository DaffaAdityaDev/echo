# desktop

Electron + React prototype of an Echo desktop client, built with electron-vite.

It is not usable with the current API. It calls `/api/v1/models` and expects `/chat` to return JSON without auth, while the real chat endpoint streams SSE and requires a login. It is also left out of the default `bun run dev`/`build`/`test` filters.

```bash
bun run dev
bun run build:win    # or build:mac / build:linux; these call npm, so Node must be installed
```

Because it is a root workspace, `bun install` at the repo root also installs Electron and runs its postinstall. If that step fails on your machine, `bun install --ignore-scripts` is enough for the other services.
