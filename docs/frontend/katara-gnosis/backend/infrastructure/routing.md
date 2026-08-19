================================================================================
  KataraGnosis Backend Routing
================================================================================
  Module    : Routing
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

All KataraGnosis endpoints live under the existing /api/v1 prefix of the Echo
backend and are wired in backend/internal/router/router.go. Path constants
are centralized in backend/internal/constants/routes/katara.go. Swagger
annotations follow the repo's docs-api pattern (swaggo + api/split + api/merge
Makefile targets).

Route Table
-----------

  Method  Path                                            Handler               Auth
  ------  ----------------------------------------------  --------------------  -----
  POST    /api/v1/katara/lakes                            katara.HandleCreateLake  JWT
  GET     /api/v1/katara/lakes                            katara.HandleListLakes   JWT
  GET     /api/v1/katara/lakes/:id                        katara.HandleGetLake     JWT
  PATCH   /api/v1/katara/lakes/:id                        katara.HandleUpdateLake  JWT
  DELETE  /api/v1/katara/lakes/:id                        katara.HandleDeleteLake  JWT
  GET     /api/v1/katara/lakes/:id/sources                katara.HandleListSources JWT
  POST    /api/v1/katara/sources                          katara.HandleUploadSource JWT
  GET     /api/v1/katara/sources                          katara.HandleListSources JWT
  GET     /api/v1/katara/sources/:id                      katara.HandleGetSource   JWT
  DELETE  /api/v1/katara/sources/:id                      katara.HandleDeleteSource JWT
  GET     /api/v1/katara/sources/:id/chunks               katara.HandleSourceChunks JWT
  POST    /api/v1/katara/sources/:id/reprocess            katara.HandleReprocess   JWT
  GET     /api/v1/katara/sources/:id/download             katara.HandleSourceDownload JWT
  GET     /api/v1/katara/flashcards                       katara.HandleListFlashcards JWT
  GET     /api/v1/katara/flashcards/:id                   katara.HandleGetFlashcard JWT
  POST    /api/v1/katara/flashcards                       katara.HandleCreateFlashcard JWT (manual)
  PATCH   /api/v1/katara/flashcards/:id                   katara.HandleUpdateFlashcard JWT
  DELETE  /api/v1/katara/flashcards/:id                   katara.HandleDeleteFlashcard JWT
  POST    /api/v1/katara/flashcards/search                katara.HandleSemanticSearch JWT
  POST    /api/v1/katara/drills                           katara.HandleCreateDrill  JWT
  GET     /api/v1/katara/drills/:id                       katara.HandleGetDrill     JWT
  GET     /api/v1/katara/drills/:id/next                  katara.HandleNextQuestion JWT
  POST    /api/v1/katara/drills/:id/answer                katara.HandleAnswer       JWT
  GET     /api/v1/katara/drills/:id/results               katara.HandleDrillResults JWT
  GET     /api/v1/katara/today                            katara.HandleToday       JWT
  GET     /api/v1/katara/progress                         katara.HandleProgress    JWT
  GET     /api/v1/katara/synthesis/weekly                 katara.HandleWeeklySheet JWT
  POST    /api/v1/katara/synthesis/weekly/regenerate      katara.HandleRegenerateSheet JWT
  GET     /api/v1/katara/jobs/:id                         katara.HandleGetJob      JWT
  POST    /api/v1/internal/embeddings                     memory.HandleEmbeddings  Service JWT

Registration Pattern
--------------------

Inside router.go, after the existing session group:

  kataraGroup := api.Group("/katara", middleware.AuthRequired(cfg.JWTSecret, tierSvc.Resolve))
  katara.SetupKataraRoutes(kataraGroup, deps)

  internalGroup := api.Group("/internal", middleware.InternalAuthRequired(cfg.ServiceJWTSecret))
  internalGroup.Post("/embeddings", katara.HandleEmbeddings)

Ownership enforcement (no cross-user access):

- Every handler resolves userID from middleware claims (c.Locals("userID")).
- Repository queries ALWAYS include user_id in WHERE clauses.
- Qdrant searches ALWAYS filter payload user_id (see pkg/qdrant).
- Garage objects are namespaced <user_id>/<source_id>.<ext>; presigned URLs
  are generated per request with short TTL (5 min) and never cached.

Middleware Chain
----------------

  CORS -> JWT AuthRequired (katara group) -> handler
       -> InternalAuthRequired (internal/embeddings)

Request size limits for multipart uploads: 50 MB (fiber app config
BodyLimit per-route), matching the personal-use scope.

Swagger
-------

Every handler carries godoc annotations (@Summary, @Description, @Tags
"Katara", @Param, @Success, @Failure, @Router) so that
`make swagger-split`/`make swagger-merge` include KataraGnosis in the
generated OpenAPI spec and docs site.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
