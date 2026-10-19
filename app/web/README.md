# web

Next.js 16 front end for Echo (React 19, TanStack Query, Zustand, Tailwind 4).

## Run

```bash
bun run dev       # http://localhost:3000
```

It needs the backend running. `BACKEND_URL` sets where it lives and defaults to `http://localhost:8080`; set it in `.env.local` if yours differs.

## How requests flow

Components never call the backend directly. Everything goes through route handlers in `src/app/api/**`, which:

- store the access and refresh tokens in httpOnly cookies on login and refresh,
- forward each call to `${BACKEND_URL}/api/v1/...` with the token as a bearer header (`src/lib/backend-proxy.ts`),
- pass the chat SSE stream through unchanged (`/api/chat/stream`).

## Layout

```
src/app           routes: chat (/ and /session/[id]), traces, prompts, maturity, docs, login
src/features      one folder per area: chat, settings, studio, debug, docs, auth
src/components    shared UI primitives (components/ui) and markdown rendering
src/lib           API client, proxy helpers, cookies
```

Colours, type sizes and radii come from the tokens in `src/app/globals.css`. Light and dark themes follow the OS setting. The token reference is in [`docs/app/web/design-system/tokens.md`](../../docs/app/web/design-system/tokens.md).

## Checks

```bash
bun test src
bunx tsc --noEmit
bun run lint
```

`next build` skips type checking (`ignoreBuildErrors`), so run `tsc` yourself before pushing.
