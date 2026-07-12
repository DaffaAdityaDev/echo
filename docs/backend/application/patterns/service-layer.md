================================================================================
  Service Layer - Business Logic Decoupling
================================================================================
  Module    : Service Layer
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Service layer separates business logic from HTTP handlers. Services have
no dependency on Fiber context — they only accept and return pure data (Go
structs/primitives). This enables logic to be tested without HTTP, leaving
handlers responsible solely for request parsing and response formatting.
AuthService is fully implemented with bcrypt hashing, credential validation,
and JWT generation.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/service/auth_service.go         | AuthService - authentication logic         |
| internal/service/model_service.go        | ModelService - listing, resolution, cache  |
| internal/handler/auth_handler.go         | AuthHandler - HTTP wrapper around service  |
| internal/handler/model_handler.go        | ModelHandler - HTTP wrapper around service |
| internal/handler/chat_handler.go         | ChatHandler - uses ModelService directly   |
+------------------------------------------+--------------------------------------------+

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

  type AuthService interface {
      Login(ctx context.Context, email, password string) (*models.User, string, error)
      Register(ctx context.Context, email, password, name string) (*models.User, string, error)
      GetUserByID(ctx context.Context, id int) (*models.User, error)
  }

  type authService struct {
      cfg      *models.Config
      userRepo repository.UserRepository
  }

  func NewAuthService(cfg *models.Config, userRepo repository.UserRepository) AuthService {
      return &authService{cfg: cfg, userRepo: userRepo}
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

  type ModelService interface {
      GetModels(ctx context.Context) ([]models.ModelInfo, error)
      ResolveModel(modelID string) (*models.ProviderConfig, error)
      GetDefault() *models.ProviderConfig
  }

  type modelService struct {
      cfg     *models.Config
      goCache openCodeGoCache
      lmCache lmStudioCache
  }

  func NewModelService(cfg *models.Config) ModelService {
      return &modelService{cfg: cfg}
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
    ├─ database.NewInfrastructure(cfg)           -> infra
    ├─ repository.NewUserRepository(infra)       -> userRepo
    │
    ├─ service.NewAuthService(cfg, userRepo)     -> authSvc
    ├─ service.NewModelService(cfg)              -> modelSvc
    │
    ├─ handler.NewAuthHandler(cfg, authSvc)      -> authHandler
    ├─ handler.NewChatHandler(cfg, infra.Redis, modelSvc) -> chatHandler
    └─ handler.NewModelHandler(modelSvc)         -> modelHandler

Entry Points & Exports
----------------------

+-----------------------------------+--------------+------------------------------------+
| Symbol                            | Kind         | Path                               |
+-----------------------------------+--------------+------------------------------------+
| AuthService                       | Interface    | service/auth_service.go:15         |
| NewAuthService(cfg, userRepo)     | Constructor  | service/auth_service.go:26         |
| ModelService                      | Interface    | service/model_service.go:30        |
| NewModelService(cfg)              | Constructor  | service/model_service.go:42        |
+-----------------------------------+--------------+------------------------------------+

Dependencies
------------

+----------------------------+-----------------------------------------------+
| Dependency                 | Used For                                      |
+----------------------------+-----------------------------------------------+
| repository.UserRepository  | Data access for AuthService                   |
| models.Config              | Configuration access                          |
| net/http                   | Fetching remote model lists (ModelService)    |
| sync.RWMutex               | Thread-safe caching (ModelService)            |
+----------------------------+-----------------------------------------------+

Source References
-----------------

- internal/service/auth_service.go - AuthService interface + struct
- internal/service/model_service.go - ModelService full implementation
- internal/router/router.go:23-24 - Service instantiation in DI graph

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
