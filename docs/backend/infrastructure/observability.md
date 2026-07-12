================================================================================
  Observability - OpenTelemetry Tracing
================================================================================
  Module    : Observability
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

The backend uses OpenTelemetry for distributed tracing. Spans are sent to an
OTel Collector via gRPC (OTLP) for visualization in platforms such as Jaeger,
Grafana Tempo, or SigNoz. Trace context (traceparent header) is propagated to
the downstream agent (Hono/Node) for end-to-end distributed tracing.

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/observability/tracer.go         | Tracer init, globals, span helpers         |
| internal/handler/chat_handler.go         | Span creation, traceparent propagation     |
| internal/config/config.go                | OTel configuration (endpoint, enable flag) |
+------------------------------------------+--------------------------------------------+

Architecture
------------

  ┌──────────┐      ┌──────────────────┐      ┌──────────────┐      ┌──────────────────┐
  │  Client  │      │  Go Backend      │      │Agent (Hono)  │      │ OTel Collector   │
  │ (Browser)│      │                  │      │              │      │                  │
  └────┬─────┘      └────────┬─────────┘      └──────┬───────┘      └────────┬─────────┘
       │  traceparent        │                        │                      │
       │────────────────────►│                        │                      │
       │                     │  ┌──────────────────┐  │                      │
       │                     │  │ HandleChat span  │  │                      │
       │                     │  │ (agent.session)  │  │                      │
       │                     │  └────────┬─────────┘  │                      │
       │                     │           │            │                      │
       │                     │     traceparent        │                      │
       │                     │──────────────────────► │                      │
       │                     │                        │  OTLP gRPC          │
       │                     │                        │─────────────────────►│
       │                     │                        │  (agent spans)      │
       │                     │  OTLP gRPC             │                      │
       │                     │──────────────────────► │                      │
       │                     │  (backend spans)       │                      │

Tracer Initialization
---------------------

  // observability/tracer.go
  var Tracer trace.Tracer

  func init() {
      Tracer = otel.Tracer("agent-harness-tracer")
  }

  func InitTracer(ctx context.Context, collectorAddr string) (*sdktrace.TracerProvider, error) {
      // 1. Create OTLP gRPC exporter (insecure connection)
      exporter, err := otlptracegrpc.New(ctx,
          otlptracegrpc.WithInsecure(),
          otlptracegrpc.WithEndpoint(collectorAddr),
      )

      // 2. Create resource metadata
      res := resource.New(ctx,
          resource.WithAttributes(
              semconv.ServiceNameKey.String("golang-agent-coordinator"),
              attribute.String("environment", "production-onprem"),
          ),
      )

      // 3. Create tracer provider
      tp := sdktrace.NewTracerProvider(
          sdktrace.WithSampler(sdktrace.AlwaysSample()),
          sdktrace.WithBatcher(exporter),
          sdktrace.WithResource(res),
      )

      otel.SetTracerProvider(tp)
      Tracer = otel.Tracer("agent-harness-tracer")
      return tp, nil
  }

Span Creation Patterns
----------------------

  Handler Span (Chat)
  ~~~~~~~~~~~~~~~~~~~

  // Chat handler - creates span with business attributes
  ctx, span := observability.Tracer.Start(ctx, "HandleChat",
      trace.WithAttributes(
          attribute.String("agent.session_id", req.MissionID),
          attribute.String("mission.id", req.MissionID),
          attribute.String("llm.model", req.Model),
      ))
  defer span.End()

  Agent Turn Tracking
  ~~~~~~~~~~~~~~~~~~~

  // Helper for tracking cognitive loops in the agent
  func TrackAgentTurn(ctx context.Context, sessionID string, turnIndex int, model string) (context.Context, trace.Span) {
      ctx, span := Tracer.Start(ctx, fmt.Sprintf("AgentTurn_#%d", turnIndex),
          trace.WithAttributes(
              attribute.String("agent.session_id", sessionID),
              attribute.Int("agent.turn", turnIndex),
              attribute.String("llm.model", model),
          ))
      return ctx, span
  }

Trace Context Propagation
-------------------------

Handling the traceparent header - parsing from incoming request and
propagating to downstream:

  // 1. Parse incoming traceparent
  tpHeader := c.Get("traceparent")
  if sc, ok := parseTraceparent(tpHeader); ok {
      ctx = trace.ContextWithRemoteSpanContext(ctx, sc)
  }

  // 2. Propagate to agent
  newTraceContext := span.SpanContext()
  agentTraceparent := fmt.Sprintf("00-%s-%s-01",
      newTraceContext.TraceID().String(),
      newTraceContext.SpanID().String())
  agentReq.Header.Set("traceparent", agentTraceparent)

traceparent Format
~~~~~~~~~~~~~~~~~~

  Format: 00-<traceID>-<spanID>-<traceFlags>
  Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
           │    │                      │                   │
           │    │                      │                   └─ Sampled (01)
           │    │                      └─ Span ID (16 hex chars)
           │    └─ Trace ID (32 hex chars)
           └─ Version (00)

Configuration
-------------

+----------------------+------------------------+--------------------------------+
| Env Var              | Default                | Description                    |
+----------------------+------------------------+--------------------------------+
| ENABLE_OTEL          | "false"                | Enable/disable OpenTelemetry   |
| OTEL_COLLECTOR_ADDR  | "otel-collector:4317"  | OTLP gRPC endpoint             |
+----------------------+------------------------+--------------------------------+

Entry Points & Exports
----------------------

+----------------------------------------------+----------+------------------------------------+
| Symbol                                       | Kind     | Path                               |
+----------------------------------------------+----------+------------------------------------+
| Tracer                                       | Global   | observability/tracer.go:16         |
|                                              | trace.   |                                    |
|                                              | Tracer   |                                    |
| InitTracer(ctx, addr)                        | Function | observability/tracer.go:23         |
| TrackAgentTurn(ctx, sessionID, turn, model)  | Function | observability/tracer.go:54         |
+----------------------------------------------+----------+------------------------------------+

Dependencies
------------

+-------------------------------------------------------+-------------------------------------------+
| Dependency                                            | Used For                                  |
+-------------------------------------------------------+-------------------------------------------+
| go.opentelemetry.io/otel                              | Core API (tracer, attributes)             |
| go.opentelemetry.io/otel/exporters/otlp/otlptracegrpc| OTLP gRPC exporter                        |
| go.opentelemetry.io/otel/sdk/trace                    | TracerProvider, Sampler, Batcher          |
| go.opentelemetry.io/otel/semconv                      | Semantic conventions                      |
+-------------------------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/observability/tracer.go - Tracer setup, helpers
- internal/handler/chat_handler.go:104-109 - Span creation in chat handler
- internal/handler/chat_handler.go:189-191 - Traceparent propagation
- cmd/server/main.go:24-38 - Tracer initialization on startup

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
