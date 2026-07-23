================================================================================
  API Documentation Pattern - Scalar & Swaggo
================================================================================
  Module    : API Documentation
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-23
================================================================================

Overview
--------

The backend uses Swaggo to generate an OpenAPI 2.0 (Swagger) specification from
Go source annotations. The spec is served at runtime by Fiber, and rendered as
an interactive reference UI via Scalar API Reference (loaded from CDN).

This approach keeps documentation co-located with handler code — annotations
live directly above each handler function, so updating an endpoint's contract
is part of the implementation change, not a separate workflow.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| api/docs.go                              | Top-level @info annotations (title,        |
|                                          | version, host, security scheme)            |
| api/docs/swagger.json                    | Generated monolithic spec (auto-gen, do    |
|                                          | not edit manually)                         |
| api/docs/swagger.yaml                    | Generated spec (YAML format)               |
| api/split/main.go                        | Modular split tool — breaks monolith into  |
|                                          | per-tag module files                       |
| api/module/_shared.json                  | Shared definitions used by 2+ modules      |
| api/module/{auth,chat,...}.json          | Per-module spec files (one per @Tag)       |
| internal/handler/*_handler.go            | Per-endpoint @Summary, @Param, @Success,   |
|                                          | @Router annotations on each handler func   |
| internal/router/router.go               | Serves Scalar HTML at GET /api/docs and    |
|                                          | spec JSON at GET /api/docs/openapi.json    |
+------------------------------------------+--------------------------------------------+

How It Works
------------

  1. Annotate:  Add swaggo comment blocks above each handler function.
  2. Generate:  Run `make swagger-gen` (calls `swag init`). Produces a
                monolithic swagger.json with ALL endpoints and definitions.
  3. Split:     Run `make swagger-split` (or `make swagger` for both steps).
                Calls api/split/main.go which reads the monolith and splits
                it into per-module files under api/module/ based on the @Tag
                annotation. Definitions used by 2+ modules go to _shared.json.
  4. Commit:    Both the monolithic api/docs/swagger.json AND the modular
                api/module/ files are committed to the repo.
  5. Serve:     Fiber serves the monolithic spec as JSON and Scalar HTML
                at runtime.
  6. Build:     Docker multi-stage re-generates the spec inside the container
                via the swagger-gen stage so production always has fresh docs.

Modular Split Pipeline
----------------------

The monolithic swagger.json is convenient for serving, but hard to consume
per-feature. The modular split solves this:

```
  swag init
      │
      ▼
  api/docs/swagger.json          ◄── Monolithic (1918 lines, all endpoints)
      │
      ▼
  api/split/main.go              ◄── Reads by @Tag, analyses $ref usage
      │
      ├── api/module/_shared.json     ◄── Defs used by 2+ modules
      ├── api/module/health.json      ◄── GET /health
      ├── api/module/auth.json        ◄── Auth endpoints + their schemas
      ├── api/module/chat.json        ◄── Chat endpoints + their schemas
      ├── api/module/sessions.json    ◄── Session CRUD + their schemas
      ├── api/module/settings.json    ◄── Settings endpoints + their schemas
      ├── api/module/models.json      ◄── Model listing + their schemas
      ├── api/module/admin.json       ◄── Admin API key mgmt + stats
      └── api/module/internal.json    ◄── Internal memory/session routes
```

### How the split tool works

1. **groupByTag** — iterates all paths in the spec, reads the first @Tag from
   each operation, and groups paths by that tag.
2. **findShared** — scans all $ref references across every operation. If a
   definition (`#/definitions/SomeModel`) is referenced by paths in 2+
   different tags, it's marked as shared (→ `_shared.json`). Internal model
   types (prefixed `echo-backend_internal_models.`) are also auto-shared.
3. **findModuleSpecific** — the remaining definitions are assigned to the tag
   whose paths reference them. If a definition is only used by Auth paths,
   it goes into `auth.json`.
4. **writeModules** — outputs one JSON file per tag. Each module file contains:
   - Root fields: `swagger`, `info`, `host`, `basePath`
   - Only its own `paths` entries
   - Only its own `definitions` (schemas not shared)
   - An `x-shared-definitions` array listing def names from `_shared.json`
     that this module depends on

### Module file schema

Each module file is a valid Swagger 2.0 fragment:

```json
{
  "swagger": "2.0",
  "info": { ... },
  "basePath": "/",
  "paths": { ... },
  "definitions": { ... },
  "x-shared-definitions": ["ApiKey", "Pagination", ...]
}
```

The `x-shared-definitions` extension tells consumers which shared schemas
(from `_shared.json`) need to be merged in for a complete picture.

### Regeneration commands

```bash
# Step 1: Generate monolithic spec
cd backend && make swagger-gen

# Step 2: Split into modules
cd backend && make swagger-split

# Both steps at once
cd backend && make swagger

# From root
make swagger-gen
```

Annotation Format
-----------------

Every exported handler function must have a swaggo comment block directly
above its signature:

  // @Summary      <one-line title>
  // @Description  <longer description of what the endpoint does>
  // @Tags         <TagGroup>   (e.g. Auth, Chat, Sessions, Admin, Memory)
  // @Accept       json
  // @Produce      json
  // @Param        request body <RequestStruct> true "Request description"
  // @Success      <status> {object} <ResponseStruct>
  // @Failure      <status> {object} map[string]string
  // @Router       /api/v1/<path> [method]

The @Router path must match the route registered in router.go exactly.

For endpoints that return SSE streams, use:
  // @Success      200 {object} string  "SSE text/event-stream"

For endpoints without a request body, omit @Param.

For health check (inline lambda in router.go), annotations are placed on a
dummy function in helpers.go with a matching @Router annotation.

Endpoint-to-Annotation Mapping
------------------------------

+------------------------------------------+------------+------------------------------+
| Handler File                             | Tag        | Endpoints                    |
+------------------------------------------+------------+------------------------------+
| auth_handler.go                          | Auth       | POST /register, POST /login, |
|                                          |            | GET /me, POST /logout        |
+------------------------------------------+------------+------------------------------+
| chat_handler.go                          | Chat       | POST /chat, GET /skills,     |
|                                          |            | GET /features, GET .../stream|
+------------------------------------------+------------+------------------------------+
| session_handler.go                       | Sessions   | CRUD /sessions, messages,    |
|                                          |            | prune                        |
+------------------------------------------+------------+------------------------------+
| model_handler.go                         | Models     | GET /models                  |
+------------------------------------------+------------+------------------------------+
| settings_handler.go                      | Settings   | GET /settings, PUT /settings,|
|                                          |            | GET /settings/defaults       |
+------------------------------------------+------------+------------------------------+
| admin_handler.go                         | Admin      | CRUD /admin/api-keys,        |
|                                          |            | GET /admin/stats             |
+------------------------------------------+------------+------------------------------+
| memory_handler.go                        | Memory     | All /internal/memory/*       |
|                                          |            | (episodic, semantic,         |
|                                          |            | procedural)                  |
+------------------------------------------+------------+------------------------------+
| helpers.go                               | Health     | GET /health                  |
+------------------------------------------+------------+------------------------------+

Adding a New Endpoint
---------------------

  1. Add the handler function to the appropriate *_handler.go file.
  2. Add a swaggo annotation block above the function (see format above).
  3. Register the route in router.go.
  4. Run `make swagger` (or `make swagger-gen && make swagger-split`) to
     regenerate the monolithic spec AND the modular module files.
  5. Verify at http://localhost:8080/api/docs.
  6. Check that the new endpoint appears in the correct module file under
     `api/module/<tag>.json`.

Regeneration
------------

  make swagger          # Full pipeline: generate + split
  make swagger-gen      # Generate monolithic spec only
  make swagger-split    # Split monolith into module files

The full pipeline runs:
  1. swag init -g cmd/server/main.go -o api/docs \
       --parseDependency --parseInternal
  2. go run ./api/split/main.go

The -g flag points to the main Go file (which imports all handlers), so swaggo
discovers every annotated function across the entire backend package.

Runtime Serving
---------------

  +-------------------+
  | Browser           |
  | /api/docs         |
  +--------+----------+
           |
           | Scalar CDN       +--------------------------+
           +----------------->| cdn.jsdelivr.net/npm/    |
           |                  | @scalar/api-reference    |
           |                  +--------------------------+
           |
           | Fiber route
           +----------------->| GET /api/docs/openapi.json
                              |  -> sends api/docs/swagger.json

The Scalar HTML page is an inline string served by Fiber at /api/docs. It
loads the @scalar/api-reference web component from CDN and points it at the
local /api/docs/openapi.json endpoint.

Docker Build
------------

During container build, a swagger-gen stage runs swag init inside the builder:
  FROM builder AS swagger-gen
  RUN go install github.com/swaggo/swag/cmd/swag@latest
  COPY . .
  RUN swag init -g cmd/server/main.go -o api/docs ...

The runner stage copies the generated api/docs directory:
  COPY --from=swagger-gen /app/api/docs ./api/docs

This means the spec is always fresh and matches the exact code in the image.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
