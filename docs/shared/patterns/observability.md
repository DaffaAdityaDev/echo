================================================================================
  OBSERVABILITY
================================================================================
  Module    : Observability
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

OpenTelemetry traces across all Echo services with W3C trace context
propagation, Langfuse integration for LLM observability, Prometheus metrics
for infrastructure monitoring, and Grafana dashboards for visualization.

## File Structure

+-------------------------------------+---------------------------------------------+
| Location                            | Role                                        |
+-------------------------------------+---------------------------------------------+
| backend/internal/observability/     |                                             |
|   tracer.go                         | OTLP exporter, tracer init, span helpers    |
| backend/internal/handler/           |                                             |
|   chat_handler.go                   | Trace propagation, span creation            |
| agent/src/utils/                    |                                             |
|   telemetry.ts                      | OTel SDK with LangfuseSpanProcessor         |
|   langfuse.ts                       | Langfuse tracing, LangChain callbacks       |
| frontend/web/src/lib/               |                                             |
|   api-client.ts                     | Frontend traceparent generation             |
| infra/                              |                                             |
|   prometheus.yml                    | Prometheus scrape config                    |
|   otel-collector-config.yaml        | Collector pipeline definition               |
|   grafana/provisioning/             | Grafana auto-provisioning                   |
+-------------------------------------+---------------------------------------------+

## Infrastructure

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVABILITY STACK                                       │
│                                                                                       │
│   ┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐  │
│   │   Echo Services  │       │   OTel Collector     │       │  Backend Destinations│  │
│   │                  │──────►│   (gRPC:4317)        │──────►│                      │  │
│   │   Go             │       │   (HTTP:4318)        │       │  ┌────────────────┐  │  │
│   │   Hono           │       │                      │       │  │ Jaeger :16686  │  │  │
│   │   Frontend       │       │                      │       │  │  Traces        │◄─│──│──│──┐
│   └──────────────────┘       └──────────────────────┘       │  └────────────────┘  │  │  │
│                                                               │  ┌────────────────┐  │  │  │
│   Direct (Agent -> Langfuse):                                 │  │ Langfuse :3000 │  │  │  │
│   Agent writes OTel spans directly to Langfuse via            │  │  LLM Traces    │◄─│──│──┤
│   LangfuseSpanProcessor                                        │  └────────────────┘  │  │  │
│                                                               │  ┌────────────────┐  │  │  │
│                                                               │  │ Prometheus     │  │  │  │
│                                                               │  │   :9090        │◄─│──│──┘  │
│                                                               │  │  Metrics       │  │  │     │
│                                                               │  └────────────────┘  │  │     │
│                                                               │  ┌────────────────┐  │  │     │
│                                                               │  │ Grafana :3100  │◄─│──│─────┘
│                                                               │  │  Dashboards    │  │
│                                                               │  └────────────────┘  │
│                                                               └──────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘

## Trace Propagation (W3C Trace Context)

FRONTEND                          GO GATEWAY                       HONO AGENT
────────                          ──────────                       ──────────

fetch(/api/v1/chat)              HandleChat()                     createMission()
  │                                 │                                │
  ├─ traceparent: "00-{tid}-        │                                │
  │   {sid}-01"                    │                                │
  │                                 │                                │
  v                                 v                                │
api-client.ts                     parseTraceparent()                 │
  generateTraceContext()            ├─ Extract traceID, spanID       │
  sets traceparent header          └─ ctx = WithRemoteSpanContext    │
                                    │                                │
                                    ├─ Tracer.Start("HandleChat")    │
                                    │  attributes:                   │
                                    │   agent.session_id             │
                                    │   mission.id                   │
                                    │   llm.model                    │
                                    │                                │
                                    │  POST /api/generate-mission    │
                                    │  traceparent: "00-{newTid}-    │
                                    │   {newSid}-01"                │
                                    │───────────────────────────────►│
                                    │                                │
                                    │                                ├─ OTel SDK picks up
                                    │                                │  traceparent
                                    │                                │
                                    │                                ├─ LangfuseSpanProcessor
                                    │                                │  creates span in
                                    │                                │  Langfuse
                                    │                                │
                                    │                                ├─ getLangChainCallbacks()
                                    │                                │  links with active OTel
                                    │                                │  ctx
                                    │                                │
                                    │   SSE stream                   │
                                    │◄───────────────────────────────│

### Traceparent Format

```
traceparent: "00-{traceID}-{spanID}-{flags}"
  version: 00
  traceID: 32 hex chars
  spanID:  16 hex chars
  flags:   01 (sampled)
```

### Go Implementation

```go
// parseTraceparent extracts remote span context from incoming header
func parseTraceparent(tp string) (trace.SpanContext, bool) {
    parts := strings.Split(tp, "-")  // "00-{traceID}-{spanID}-{flags}"
    traceID, _ := trace.TraceIDFromHex(parts[1])
    spanID, _ := trace.SpanIDFromHex(parts[2])
    return trace.NewSpanContext(trace.SpanContextConfig{
        TraceID:    traceID,
        SpanID:     spanID,
        TraceFlags: trace.FlagsSampled,
        Remote:     true,
    }), true
}

// Propagation to Agent
newTraceContext := span.SpanContext()
traceparent := fmt.Sprintf("00-%s-%s-01",
    newTraceContext.TraceID().String(),
    newTraceContext.SpanID().String())
agentReq.Header.Set("traceparent", traceparent)
```

### Frontend Implementation

```typescript
// api-client.ts
const { traceparent } = generateTraceContext();
headers.set("traceparent", traceparent);
```

## Go Backend Tracing

### Init

```go
func InitTracer(ctx context.Context, collectorAddr string) (*sdktrace.TracerProvider, error) {
    exporter, _ := otlptracegrpc.New(ctx,
        otlptracegrpc.WithInsecure(),
        otlptracegrpc.WithEndpoint(collectorAddr),
    )
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithSampler(sdktrace.AlwaysSample()),
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.New(ctx,
            resource.WithAttributes(
                semconv.ServiceNameKey.String("golang-agent-coordinator"),
                attribute.String("environment", "production-onprem"),
            ),
        )),
    )
    otel.SetTracerProvider(tp)
    Tracer = otel.Tracer("agent-harness-tracer")
    return tp, nil
}
```

### Spans Created

```go
Tracer.Start(ctx, "HandleChat", trace.WithAttributes(
    attribute.String("agent.session_id", req.MissionID),
    attribute.String("mission.id", req.MissionID),
    attribute.String("llm.model", req.Model),
))

// Per cognitive loop turn:
TrackAgentTurn(ctx, sessionID, turnIndex, model)
// Creates span: "AgentTurn_#N" with agent.session_id, agent.turn, llm.model
```

## Agent Tracing (Langfuse)

### SDK Initialization

```typescript
// telemetry.ts — uses LangfuseSpanProcessor
const langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey: ENV.LANGFUSE_PUBLIC_KEY,
    secretKey: ENV.LANGFUSE_SECRET_KEY,
    baseUrl: ENV.LANGFUSE_BASE_URL,
});

const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
});
sdk.start();
```

### Agent Trace Start

```typescript
// langfuse.ts
export function startAgentTrace(traceId, missionId, userId, strategyName, objective) {
    const trace = startObservation("agent-run-mission", {
        input: objective,
        metadata: { strategy: strategyName },
        version: "5.0.0",
    });
    return trace;
}
```

### LangChain Callback Integration

```typescript
export async function getLangChainCallbacks() {
    const store = langfuseStorage.getStore();
    const tracer = new CallbackHandler({
        sessionId: store?.sessionId,
        userId: store?.userId,
    });
    return [tracer];
}
```

### Langfuse Credentials (Required)

```env
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_BASE_URL=http://localhost:3000
```

## Metrics (Prometheus)

### Planned Metrics

+--------------------------+-----------+----------------------------------------+
| Metric                   | Type      | Description                            |
+--------------------------+-----------+----------------------------------------+
| mission_created_total    | Counter   | Total missions created                 |
| mission_duration_seconds | Histogram | Mission execution time                 |
| card_recall_rate         | Gauge     | Spaced repetition recall rate          |
| tool_latency_seconds     | Histogram | Tool execution latency                 |
| llm_tokens_total         | Counter   | Total LLM tokens used                  |
| http_requests_total      | Counter   | HTTP requests by path and status       |
| active_sessions          | Gauge     | Concurrent agent sessions              |
+--------------------------+-----------+----------------------------------------+

### Prometheus Config (`infra/prometheus.yml`)
- Scrapes OTel Collector at `:8889` (prometheus exporter endpoint, namespace `agent_platform`)

### Docker Compose (`docker-compose.yml`)

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: echo_prometheus
  command: ["--config.file=/etc/prometheus/prometheus.yml"]
  volumes:
    - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  container_name: echo_grafana
  volumes:
    - ./infra/grafana/provisioning:/etc/grafana/provisioning
  ports:
    - "3100:3000"
  depends_on:
    - prometheus
```

## OTel Collector Config

```yaml
# infra/otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: "agent_platform"
  otlp/jaeger:
    endpoint: "jaeger:4317"
    tls:
      insecure: true
  logging:
    verbosity: basic

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/jaeger, logging]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus, logging]
```

## Service Resource Attributes

+-----------------+------------------------------+----------------------+
| Service         | Service Name (semconv)       | Environment          |
+-----------------+------------------------------+----------------------+
| Go Backend      | golang-agent-coordinator     | production-onprem    |
| Agent           | (Langfuse default)           | via NODE_ENV         |
| Frontend        | (browser)                    | N/A                  |
+-----------------+------------------------------+----------------------+

## Entry Points & Exports

- **Go tracer init**: `backend/internal/observability/tracer.go:23-51`
- **Go span helpers**: `backend/internal/observability/tracer.go:54-63`
- **Go trace propagation**: `backend/internal/handler/chat_handler.go:68-90,
  98-102, 188-191`
- **Agent OTel SDK**: `agent/src/utils/telemetry.ts:1-39`
- **Agent Langfuse**: `agent/src/utils/langfuse.ts:1-65`
- **Agent LangChain callbacks**: `agent/src/utils/langfuse.ts:16-29`
- **Frontend trace context**: `frontend/web/src/lib/api-client.ts:27-29`

## Dependencies

- **Go**: `go.opentelemetry.io/otel`, `otlptracegrpc`, `sdktrace`
- **Agent**: `@opentelemetry/sdk-node`, `@langfuse/otel`,
  `@langfuse/langchain`, `@langfuse/tracing`
- **Infrastructure**: `otel/opentelemetry-collector-contrib`,
  `jaegertracing/all-in-one`, `prom/prometheus`, `grafana/grafana`

## Source References

+-------------------------------------------------------+-------+--------------------------------------+
| File                                                  | Lines | Role                                 |
+-------------------------------------------------------+-------+--------------------------------------+
| backend/internal/observability/tracer.go              | 23-51 | OTLP exporter, tracer init           |
| backend/internal/observability/tracer.go              | 54-63 | TrackAgentTurn span helper           |
| backend/internal/handler/chat_handler.go              | 68-90 | parseTraceparent                     |
| backend/internal/handler/chat_handler.go              | 98-102| RemoteSpanContext injection          |
| backend/internal/handler/chat_handler.go              | 104-  | HandleChat span start                |
|                                                       | 109   |                                      |
| backend/internal/handler/chat_handler.go              | 188-  | Traceparent propagation to Agent     |
|                                                       | 191   |                                      |
| agent/src/utils/telemetry.ts                          | 1-39  | OTel SDK with LangfuseSpanProcessor  |
| agent/src/utils/langfuse.ts                           | 34-63 | startAgentTrace                      |
| agent/src/utils/langfuse.ts                           | 16-29 | getLangChainCallbacks                |
| frontend/web/src/lib/api-client.ts                    | 65-69 | Frontend traceparent generation      |
| docker-compose.yml                                    | 42-80 | Observability infra services         |
+-------------------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
