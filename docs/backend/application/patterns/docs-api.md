================================================================================
  API Documentation Pattern - Scalar & Swaggo
================================================================================
  Module    : API Documentation
  Service   : backend
  Version   : 1.0
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
| api/docs/swagger.json                    | Generated spec (auto-generated, do not     |
|                                          | edit manually)                             |
| api/docs/swagger.yaml                    | Generated spec (YAML format)               |
| internal/handler/*_handler.go            | Per-endpoint @Summary, @Param, @Success,   |
|                                          | @Router annotations on each handler func   |
| internal/router/router.go               | Serves Scalar HTML at GET /api/docs and    |
|                                          | spec JSON at GET /api/docs/openapi.json    |
+------------------------------------------+--------------------------------------------+

How It Works
------------

  1. Annotate:  Add swaggo comment blocks above each handler function.
  2. Generate:  Run `make swagger-gen` (calls `swag init`).
  3. Commit:    The generated api/docs/swagger.json is committed to the repo.
  4. Serve:     Fiber serves the spec as JSON and Scalar HTML at runtime.
  5. Build:     Docker multi-stage re-generates the spec inside the container
                via the swagger-gen stage so production always has fresh docs.

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
  4. Run `make swagger-gen` to regenerate the spec.
  5. Verify at http://localhost:8080/api/docs.

Regeneration
------------

  make swagger-gen

This runs:
  cd backend && swag init -g cmd/server/main.go -o api/docs \
    --parseDependency --parseInternal

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
