================================================================================
  Observability Setup - OpenTelemetry Tracer Configuration
================================================================================
  Module    : Observability Setup
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Overview
--------

Observability setup covers OpenTelemetry tracer provider initialization, gRPC
exporter configuration to OTel Collector, and span creation patterns for
tracing requests that cross service boundaries (client -> backend -> agent).

File Structure
--------------

+------------------------------------------+--------------------------------------------+
| Path                                     | Description                                |
+------------------------------------------+--------------------------------------------+
| internal/observability/tracer.go         | Tracer init & helper functions             |
| internal/handler/chat_handler.go         | Span usage + traceparent propagation       |
| cmd/server/main.go                       | Conditional tracer init                    |
+------------------------------------------+--------------------------------------------+

Tracer Initialization Flow
--------------------------

  main.go
    │
    └─ cfg.EnableOtel == true?
         │
         └─ Yes -> observability.InitTracer(ctx, collectorAddr)
                      │
                      ├─ 1. Create OTLP gRPC Exporter
                      │      otlptracegrpc.New(
                      │        WithInsecure(),
                      │        WithEndpoint(collectorAddr),
                      │      )
                      │
                      ├─ 2. Create Resource
                      │      resource.New(
                      │        semconv.ServiceNameKey.String("golang-agent-coordinator"),
                      │        attribute.String("environment", "production-onprem"),
                      │      )
                      │
                      ├─ 3. Create TracerProvider
                      │      sdktrace.NewTracerProvider(
                      │        AlwaysSample(),
                      │        WithBatcher(exporter),
                      │        WithResource(res),
                      │      )
                      │
                      ├─ 4. Set Global Provider
                      │      otel.SetTracerProvider(tp)
                      │
                      └─ 5. Reset package-level Tracer
                            Tracer = otel.Tracer("agent-harness-tracer")

Global Tracer
-------------

  // Package-level global tracer - used across all handlers
  var Tracer trace.Tracer

  func init() {
      Tracer = otel.Tracer("agent-harness-tracer")
  }

Exporter Configuration
----------------------

+-------------+----------------------------------------+--------------------------------+
| Option      | Value                                  | Notes                          |
+-------------+----------------------------------------+--------------------------------+
| Protocol    | gRPC (OTLP)                            | Standard OTel protocol         |
| Transport   | Insecure (WithInsecure())              | Internal network, no TLS       |
| Endpoint    | cfg.OtelCollectorAddr                  | Default: "otel-collector:4317" |
| Sampler     | AlwaysSample()                         | Sample every span (dev/onprem) |
| Batcher     | Default                                | Batch export for efficiency    |
+-------------+----------------------------------------+--------------------------------+

Resource Attributes
-------------------

+-----------------+----------------------------------------+
| Attribute       | Value                                  |
+-----------------+----------------------------------------+
| service.name    | "golang-agent-coordinator"             |
| environment     | "production-onprem"                    |
+-----------------+----------------------------------------+

Span Creation Patterns
----------------------

  Handler Span (Chat)
  ~~~~~~~~~~~~~~~~~~~

  // chat_handler.go:104
  ctx, span := observability.Tracer.Start(ctx, "HandleChat",
      trace.WithAttributes(
          attribute.String("agent.session_id", req.MissionID),
          attribute.String("mission.id", req.MissionID),
          attribute.String("llm.model", req.Model),
      ))
  defer span.End()

  Agent Turn Tracking
  ~~~~~~~~~~~~~~~~~~~

  // tracer.go:54 - Helper for cognitive loop tracking
  func TrackAgentTurn(ctx context.Context, sessionID string, turnIndex int, model string) (context.Context, trace.Span) {
      ctx, span := Tracer.Start(ctx, fmt.Sprintf("AgentTurn_#%d", turnIndex),
          trace.WithAttributes(
              attribute.String("agent.session_id", sessionID),
              attribute.Int("agent.turn", turnIndex),
              attribute.String("llm.model", model),
          ))
      return ctx, span
  }

  Error Recording
  ~~~~~~~~~~~~~~~

  // chat_handler.go:128 - Record error on span
  span.RecordError(fmt.Errorf("access denied: feature %s requires pro", feat.Name))

Trace Context Propagation
-------------------------

  Parsing Incoming traceparent
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~

  // chat_handler.go:68-90
  func parseTraceparent(tp string) (trace.SpanContext, bool) {
      // Format: 00-<traceID>-<spanID>-<traceFlags>
      if !strings.HasPrefix(tp, "00-") { return zero, false }
      parts := strings.Split(tp, "-")
      // Parse hex TraceID, SpanID from parts[1], parts[2]
      return trace.NewSpanContext(..., Remote: true), true
  }

  Propagating Downstream
  ~~~~~~~~~~~~~~~~~~~~~~

  // chat_handler.go:189-191
  newTraceContext := span.SpanContext()
  agentTraceparent := fmt.Sprintf("00-%s-%s-01",
      newTraceContext.TraceID().String(),
      newTraceContext.SpanID().String())
  agentReq.Header.Set("traceparent", agentTraceparent)

Entry Points & Exports
----------------------

+----------------------------------------------------+----------+------------------------------------+
| Symbol                                             | Kind     | Path                               |
+----------------------------------------------------+----------+------------------------------------+
| Tracer                                             | Global   | observability/tracer.go:16         |
|                                                    | trace.   |                                    |
|                                                    | Tracer   |                                    |
| InitTracer(ctx, addr)                              | Function | observability/tracer.go:23         |
| TrackAgentTurn(ctx, sessionID, turn, model)        | Function | observability/tracer.go:54         |
+----------------------------------------------------+----------+------------------------------------+

Dependencies
------------

+-------------------------------------------------------+-------------------------------------------+
| Dependency                                            | Used For                                  |
+-------------------------------------------------------+-------------------------------------------+
| go.opentelemetry.io/otel                              | Tracer API, attribute                     |
| go.opentelemetry.io/otel/exporters/otlp/otlptracegrpc| gRPC exporter                             |
| go.opentelemetry.io/otel/sdk/trace                    | TracerProvider, Sampler                   |
| go.opentelemetry.io/otel/sdk/resource                 | Resource attributes                       |
| go.opentelemetry.io/otel/semconv                      | Semantic conventions                      |
| go.opentelemetry.io/otel/trace                        | Span, SpanContext                         |
+-------------------------------------------------------+-------------------------------------------+

Source References
-----------------

- internal/observability/tracer.go - Full tracer setup
- internal/handler/chat_handler.go:68-90 - traceparent parsing
- internal/handler/chat_handler.go:104-109 - Span creation
- internal/handler/chat_handler.go:128 - Error recording
- internal/handler/chat_handler.go:189-191 - Downstream propagation
- cmd/server/main.go:24-38 - Conditional tracer init

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
