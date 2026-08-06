================================================================================
  Service Layer - Business Logic Decoupling
================================================================================
  Module    : Service Layer
  Service   : backend
  Version   : 1.1
  Updated   : 2026-07-27
================================================================================

Overview
--------

The Service layer separates business logic from HTTP handlers. Services have
no dependency on Fiber context — they only accept and return pure data (Go
structs/primitives). This enables logic to be tested without HTTP, leaving
handlers responsible solely for request parsing and response formatting.

Each domain gets its own sub-package under service/:

  service/auth/           Authentication logic
  service/aimodel/          Model resolution & caching
  service/consolidation/  Token threshold & memory consolidation
  service/settings/       User preferences management
  service/llmops/         Prompt versioning business logic

File Structure
--------------

+------------------------------------------------+--------------------------------------------+
| Path                                           | Description                                |
+------------------------------------------------+--------------------------------------------+
| internal/service/auth/service.go               | AuthService - authentication logic         |
| internal/service/aimodel/service.go           | AiModelService - listing, resolution, cache|
| internal/service/consolidation/service.go      | ConsolidationService - token management    |
| internal/service/settings/service.go           | SettingsService - user preferences         |
| internal/handler/auth/handler.go               | AuthHandler - HTTP wrapper around service  |
| internal/handler/aimodel/handler.go           | AiModelHandler - HTTP wrapper around service|
| internal/handler/chat/handler.go               | ChatHandler - uses ModelService directly   |
+------------------------------------------------+--------------------------------------------+

Principles
----------

  ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
  │ HTTP Handler     │       │ Service (pure Go)│       │ Repository (data)│
  │ (Fiber ctx)      │       │                  │       │                  │
  └──────┬───────────┘       └────────┬─────────┘       └────────┬─────────┘
         │  Parse request             │                          │
         │───────────────────────────►│                          │
         │                            │  Business logic          │
         │                            │  validation              │
         │                            │  authorization           │
         │                            │  transformation          │
         │                            │  data                    │
         │                            │◄─────────────────────────│
         │  Return result             │                          │
         │◄───────────────────────────│                          │
         │  Format HTTP response      │                          │
         │                            │                          │

AuthService
-----------

  type Service interface {
      Login(ctx context.Context, email, password string) (*models.User, string, error)
      Register(ctx context.Context, email, password, name string) (*models.User, string, error)
      GetUserByID(ctx context.Context, id int) (*models.User, error)
  }

  type service struct {
      cfg      *models.Config
      userRepo authrepo.Repository
  }

  func NewService(cfg *models.Config, userRepo authrepo.Repository) Service {
      return &service{cfg: cfg, userRepo: userRepo}
  }

Implemented methods:

  - Login(ctx, email, password)
        1. userRepo.GetByEmail(ctx, email)
        2. bcrypt.CompareHashAndPassword(user.PasswordHash, password)
        3. generateToken(cfg, user.ID) → JWT HS256
        4. Return (user, token, nil)
  - Register(ctx, email, password, name)
        1. bcrypt.GenerateFromPassword(password)
        2. userRepo.Create(ctx, user) → INSERT INTO users
        3. generateToken(cfg, user.ID) → JWT HS256
        4. Return (user, token, nil)
  - GetUserByID(ctx, id)
        1. userRepo.GetUserByID(ctx, id) → SELECT ... WHERE id = $1
        2. Return (*models.User, nil)

ModelService
------------

  type Service interface {
      GetModels(ctx context.Context) ([]models.ModelInfo, error)
      ResolveModel(modelID string) (*models.ProviderConfig, error)
      GetDefault() *models.ProviderConfig
  }

  type service struct {
      cfg     *models.Config
      goCache openCodeGoCache
      lmCache lmStudioCache
  }

  func NewService(cfg *models.Config) Service {
      return &service{cfg: cfg}
  }

Key behaviors:
  - GetModels()       - Aggregates models from all configured providers
  - ResolveModel()    - Maps model ID -> ProviderConfig
  - GetDefault()      - Returns default provider config (fallback to gpt-4o)
  - Thread-safe caching with sync.RWMutex + double-checked locking

Dependency Injection Flow
-------------------------

  router.go
    │
    ├─ database.NewPostgresPool(cfg)              -> pool
    ├─ repository/auth.NewRepository(pool)        -> userRepo
    │
    ├─ service/auth.NewService(cfg, userRepo)     -> authSvc
    ├─ service/aimodel.NewService(cfg, settingsSvc) -> aimodelSvc
    │
    ├─ handler/auth.NewHandler(cfg, authSvc)      -> authHandler
    ├─ handler/chat.NewHandler(cfg, rdb, aimodelSvc, ...) -> chatHandler
    └─ handler/aimodel.NewHandler(aimodelSvc)   -> aimodelHandler

Entry Points & Exports
----------------------

+-----------------------------------+--------------+------------------------------------+
| Symbol                            | Kind         | Path                               |
+-----------------------------------+--------------+------------------------------------+
| Service (interface)               | Interface    | service/auth/service.go            |
| NewService(cfg, userRepo)         | Constructor  | service/auth/service.go            |
| Service                            | Struct       | service/aimodel/service.go        |
| NewService(cfg, settingsSvc)       | Constructor  | service/aimodel/service.go        |
| Service (interface)               | Interface    | service/consolidation/service.go   |
| NewService(cfg, sessionRepo)      | Constructor  | service/consolidation/service.go   |
+-----------------------------------+--------------+------------------------------------+

Dependencies
------------

+----------------------------+-----------------------------------------------+
| Dependency                 | Used For                                      |
+----------------------------+-----------------------------------------------+
| repository/*               | Data access for Service                        |
| models.Config              | Configuration access                           |
| net/http                   | Fetching remote model lists (ModelService)    |
| sync.RWMutex               | Thread-safe caching (ModelService)            |
+----------------------------+-----------------------------------------------+

Source References
-----------------

- internal/service/auth/service.go - AuthService interface + struct
- internal/service/aimodel/service.go - AiModelService full implementation
- internal/service/consolidation/service.go - ConsolidationService
- internal/router/router.go - Service instantiation in DI graph

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
