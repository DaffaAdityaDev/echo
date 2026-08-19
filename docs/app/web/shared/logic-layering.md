================================================================================
  Logic Layering — Business vs System Logic
================================================================================
  Module    : Logic Layering
  Service   : Web
  Version   : 1.0
  Updated   : 2026-08-07
================================================================================

## Description

Defines where code lives based on whether it encodes Echo domain knowledge
(business logic) or generic, reusable behavior (system logic). Violations
produce feature hooks full of generic utilities, and duplicated helpers
scattered across components.

## The Boundary

**System logic** = domain-agnostic. It does not know what a "session",
"mission", or "prompt" is. A different app could copy it unchanged.

**Business logic** = knows Echo's domains (chat sessions, missions, prompts,
settings, maturity). It orchestrates system primitives and owns domain state.

### Decision test

1. "Does this reference a domain concept (session/mission/prompt/model/feature)?" → Business.
2. "Would a to-do app reuse this as-is?" → System.
3. "Does it touch the framework generically (react-query plumbing, clipboard, storage, download)?" → System.

## Location Rules

| Layer | Location | Examples |
|---|---|---|
| System: pure utils | `src/utils/` | `downloadJson`, `extractErrorMessage`, `getStorage/setStorage`, `formatBytes` |
| System: generic hooks | `src/hooks/` | `useCopyToClipboard`, `useToast` |
| System: generic UI | `src/components/ui/` | `Tabs`, `Toast`, `Modal`, `CopyButton` |
| System: lib plumbing | `src/lib/` | `api-client`, `proxy-fetch`, `query-standard`, `get-query-client` |
| Business: feature hooks | `features/<feature>/hooks/` | `useChatStream`, `useSessionsInfinite`, `useHitlApproval`, `useSettingsPage` |
| Business: services | `features/<feature>/services/` | `chat-api.ts`, `settings-api.ts` |
| Business: stores | `features/<feature>/stores/` | `chatStore`, `settingsStore` |
| Business: constants/keys | `features/<feature>/constants.ts` | `CHAT_QUERY_KEYS`, `PACKET_TYPES` |

## Rules

1. **Generic helpers never live inside feature hooks.** A hook that exports a
   utility other features would reuse is a sign the utility belongs in
   `src/utils/` or `src/hooks/`.
2. **No per-field selector wrapper hooks.** Zustand stores are consumed with
   inline selectors: `useChatStore((s) => s.messages)`. A file of 24
   one-line `useXxx()` wrappers is boilerplate, not abstraction
   (`useChatSelectors.ts` was deleted for this reason).
3. **Query cache is the store for server data.** Do not mirror server-fetched
   data into a Zustand store that is never read (the write-only `catalogStore`
   was deleted). Zustand is for client-only UI state.
4. **Query keys are constants, not inline strings.** Per-feature key objects
   live in `features/<feature>/constants.ts` (see `AUTH_QUERY_KEYS`,
   `CHAT_QUERY_KEYS`). Inline key strings break invalidations silently.
5. **One concern per hook.** `useChatStream` streams; `useSessions` manages
   CRUD; `useSettingsPage` loads config. Do not merge them.
6. **Duplicated logic = extract.** Before re-implementing a util, grep
   `src/utils/`, `src/hooks/`, and `src/components/ui/` (anti-slop rule 5).

## Source References

- `src/utils/download.ts`, `error.ts`, `storage.ts`, `format.ts`
- `src/hooks/useCopyToClipboard.ts`, `useToast.tsx`
- `src/components/ui/Tabs.tsx`, `Toast.tsx`
- `src/features/chat/constants.ts` (`CHAT_QUERY_KEYS`)
- `docs/shared/patterns/anti-slop.md` — DRY rule
- `docs/shared/patterns/acid-solid-clean-code.md` — SOLID frontend section

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
