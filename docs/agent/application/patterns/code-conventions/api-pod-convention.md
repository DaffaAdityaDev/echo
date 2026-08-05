================================================================================
  Feature Pod Convention — API Layer File Structure Standard
================================================================================
  Module    : Code Conventions
  Service   : agent
  Version   : 1.1
  Updated   : 2026-08-04
================================================================================

## Purpose

One single standard for placing HTTP API feature files — zero decision fatigue
when creating or extending an API feature. There is no "it depends on the
situation": every feature pod looks the same, so neither a developer nor an AI
agent ever has to ask where a file belongs.

---

## The Standard (Non-Negotiable)

Every feature under `src/adapter/inbound/api/<feature>/` MUST have this
identical 3-file structure. The constants file is optional.

```text
src/adapter/inbound/api/<feature>/
├── <feature>.routes.ts       <-- HTTP route definitions & mounting (thin)
├── <feature>.controller.ts   <-- Business orchestration & streaming
├── <feature>.schema.ts       <-- MANDATORY: all Zod request/response validation
└── <feature>.constants.ts    <-- (Optional) Constants & default values
```

### Controller Style

Controllers in `<feature>.controller.ts` MUST be module-level exported handler
functions — stateless, taking `(c: Context)` and returning the response.
Class/singleton boilerplate (`class XController` +
`export const xController = new XController()`) is NOT allowed. Exception: a
class is allowed only when the module genuinely holds instance state — e.g.
`stream.transport.ts`'s `HttpStreamTransport`.

### Rule 1 — One Feature = One Schema File

All Zod validation for request bodies, URL parameters, and query parameters
MUST live in `<feature>.schema.ts` inside the feature's own folder.

*Mental model:* want to edit the input/validation of feature X? Open
`api/X/X.schema.ts`. Never anywhere else.

### Rule 2 — No Cross-Feature Schema Imports

If Feature A needs a type/schema from Feature B, do NOT import it directly
from B. Extract the base type to `src/shared/types/` or `src/shared/schemas/`
first, then both features import from there.

### Rule 3 — System/Config Schema Exceptions

Schemas that are NOT feature API inputs live in standard central locations:

- `src/config/env.schema.ts` — environment variable validation
- `src/shared/schemas/` — global shared payloads

### Infra Exception

`docs/` (Scalar API reference page) is infrastructure, not a feature pod. Like
`middleware/`, it is exempt from the pod structure.

---

## Benefits

- **Zero decision fatigue:** never ask "where should this schema go?"
- **Atomic deletion/refactoring:** delete or rename one feature folder — no
  orphaned schema files left behind in other folders.
- **100% predictable for agents:** file locations are guessable without
  search/grep across the codebase.

---

## Backend (Go) Analog

The same pod idea applies to the backend service: `internal/handler/<feature>/`
holds all HTTP handling for one feature, and validation lives in
`internal/models/<feature>/`.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
