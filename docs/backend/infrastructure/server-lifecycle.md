================================================================================
  Server Lifecycle - Startup & Shutdown
================================================================================
  Module    : Server Lifecycle
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The Server lifecycle starts in main.go, which loads configuration, initializes
tracing, and starts the Fiber HTTP server. Graceful shutdown will be
implemented using context cancellation upon receiving termination signals.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| cmd/server/main.go                       | Entry point - config, tracing, start       |
| internal/server/server.go                | Server struct - Fiber instance, Start()    |
| internal/config/config.go                | Config loading from env vars               |
| internal/observability/tracer.go         | OpenTelemetry tracer init                  |
+------------------------------------------+--------------------------------------------+

Startup Sequence
----------------

   main.go
     │
     ├─ 1. godotenv.Load()
     │        Load .env file (optional - warning if not found)
     │
     ├─ 2. config.Load()
     │        Read all env vars -> return *models.Config
     │
     ├─ 3. (if cfg.EnableOtel)
     │      observability.InitTracer(ctx, cfg.OtelCollectorAddr)
     │        ├─ Create OTLP gRPC exporter (insecure)
     │        ├─ Create resource (service name, environment)
     │        ├─ Create TracerProvider (AlwaysSample, batcher)
     │        └─ Set global tracer provider
     │
     ├─ 4. server.NewServer(cfg)
     │        ├─ fiber.New(Config{AppName})
     │        ├─ recover middleware
     │        ├─ logger middleware
     │        ├─ cors middleware
     │        └─ router.SetupRoutes(fbApp, cfg)
     │
     └─ 5. srv.Start()
           └─ s.App.Listen(":" + s.Cfg.Port)   // port from config, default :8080

Startup Flow Diagram
--------------------

  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐
  │ .env     │───►│ config   │───►│ observability│───►│  server   │
  │ Load     │    │ Load()   │    │ InitTracer() │    │ NewServer │
  └──────────┘    └──────────┘    └──────────────┘    └─────┬─────┘
                                                             │
                    ┌────────────────────────────────────────┘
                    ▼
          ┌───────────────────────┐
          │   fiber.New()         │
          │     + recover         │
          │     + logger          │
          │     + cors            │
          │     + routes          │
          └───────────┬───────────┘
                      ▼
           ┌──────────────────────────┐
           │   Listen(:<cfg.Port>)   │
           │   ┌────────────────┐    │
           │   │  Accepting     │    │
           │   │  Requests      │    │
           │   └────────────────┘    │
           └──────────────────────────┘

Server Configuration
--------------------

+----------------+-------------------------------------------------+------------------+
| Setting        | Value                                           | Source           |
+----------------+-------------------------------------------------+------------------+
| AppName        | "Echo Backend API"                              | constants/app/   |
|                |                                                 | app.go           |
| Port           | From PORT env / default "8080"                  | config.Load()    |
| AllowOrigins   | From ALLOW_ORIGINS env                           | config.Load()    |
+----------------+-------------------------------------------------+------------------+

Graceful Shutdown
-----------------

Currently graceful shutdown is not implemented (Fiber Listen blocking call).
Planned implementation:

  // Planned graceful shutdown pattern:
  func (s *Server) Start() error {
      quit := make(chan os.Signal, 1)
      signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

      go func() {
          <-quit
          log.Println("Shutting down server...")
          // ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
          // defer cancel()
          // s.App.ShutdownWithContext(ctx)
      }()

      return s.App.Listen(":" + s.Cfg.Port)
  }

Entry Points & Exports
----------------------

+--------------------+--------------+------------------------------------+
| Symbol             | Kind         | Path                               |
+--------------------+--------------+------------------------------------+
| main()             | Entry point  | cmd/server/main.go:14              |
| NewServer(cfg)     | Constructor  | server/server.go:20                |
| Server{App, Cfg}   | Struct       | server/server.go:15                |
| server.Start()     | Method       | server/server.go:47                |
+--------------------+--------------+------------------------------------+

Dependencies
------------

+----------------------------+-----------------------------------------------+
| Dependency                 | Used For                                      |
+----------------------------+-----------------------------------------------+
| github.com/joho/godotenv  | .env file loading                             |
| github.com/gofiber/fiber/v3| HTTP server                                  |
| internal/config            | Configuration                                 |
| internal/observability    | Tracing                                       |
| internal/router            | Route setup                                   |
+----------------------------+-----------------------------------------------+

Source References
-----------------

- cmd/server/main.go - Entry point, startup orchestration
- internal/server/server.go - Server struct, middleware setup, Listen
- internal/config/config.go - Configuration loading
- internal/observability/tracer.go - OTel tracer initialization

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
