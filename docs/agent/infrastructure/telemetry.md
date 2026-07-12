================================================================================
  Telemetry - OpenTelemetry and Langfuse Observability
================================================================================
  Module    : Telemetry
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The agent service uses OpenTelemetry (OTel) as the telemetry backbone with the
Langfuse OTel span processor exporting traces to a Langfuse instance. A custom
`AsyncLocalStorage`-based context store bridges Langfuse trace/span context across
async boundaries, used by the LangChain callback handler and the `OpenCodeGoProvider`.

---

## File Structure

```
src/utils/
  telemetry.ts          # OTel SDK initialization, LangfuseSpanProcessor
  langfuse.ts           # AsyncLocalStorage context, LangChain callbacks, startAgentTrace
src/shared/utils/
  logger.ts             # Logger class with langfuse event logging
```

---

## Flow Diagram - Telemetry Data Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Application Code                                  │
│                                                                           │
│  AgentHarness.runMission() → startAgentTrace() creates OTel span         │
│                                                                           │
│  LLM Provider .stream() → getLangChainCallbacks() returns [CallbackHandler]│
│                                                                           │
│  Logger.langfuse() → langfuseStorage.getStore() → activeObservation      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry NodeSDK                                   │
│  spanProcessors: [ LangfuseSpanProcessor ]                               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 │ exports OTLP
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Langfuse Instance                                   │
│  (ENV.LANGFUSE_BASE_URL)                                                 │
│  API Key: LANGFUSE_*KEY                                                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Langfuse Dashboard                                   │
│                      /traces/{traceId}                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+-----------------------------+-------------------------------------+--------------------------------------------------+
| Export                      | Source                              | Description                                      |
+-----------------------------+-------------------------------------+--------------------------------------------------+
| `langfuseStorage`           | `utils/langfuse.ts:14`              | AsyncLocalStorage context store                  |
| `getLangChainCallbacks()`   | `utils/langfuse.ts:16`              | Returns [CallbackHandler] for LangChain          |
| `startAgentTrace()`         | `utils/langfuse.ts:34`              | Creates root OTel observation with metadata      |
| `propagateAttributes`       | `utils/langfuse.ts`                 | Re-exported from @langfuse/tracing              |
| `sdk` (NodeSDK)             | `utils/telemetry.ts:30`             | OTel SDK with LangfuseSpanProcessor             |
| `logger`                    | `shared/utils/logger.ts:185`        | Logger singleton with langfuse() method          |
| `callbackHandler`           | `@langfuse/langchain`               | LangChain callback for OTel linking              |
+-----------------------------+-------------------------------------+--------------------------------------------------+

### LangfuseStorageContext Interface

```typescript
interface LangfuseStorageContext {
  trace?: any;       // root OTel observation
  span?: any;        // child span (not always set)
  sessionId?: string;
  userId?: string;
}
```

---

## Dependencies

+----------------------------+-------------+---------------------------------------------------+
| Dependency                 | Version     | Usage                                             |
+----------------------------+-------------+---------------------------------------------------+
| `@opentelemetry/sdk-node`  | ^0.218.0    | OTel SDK for Node.js                              |
| `@langfuse/otel`           | ^5.4.1      | LangfuseSpanProcessor — exports OTel to Langfuse  |
| `@langfuse/langchain`      | ^5.4.1      | LangChain callback handler for Langfuse tracing   |
| `@langfuse/tracing`        | ^5.4.1      | startObservation, propagateAttributes             |
| `@opentelemetry/api`       | —           | diag logging interface                            |
| `node:async_hooks`         | built-in    | AsyncLocalStorage                                 |
+----------------------------+-------------+---------------------------------------------------+

---

## Source References

+----------------------------------+-----------------------------+---------------------------------------------------+
| File                             | Line                        | Description                                       |
+----------------------------------+-----------------------------+---------------------------------------------------+
| `utils/telemetry.ts`             | 1-39                        | OTel SDK init, LangfuseSpanProcessor, diag       |
| `utils/langfuse.ts`              | 1-65                        | AsyncLocalStorage, LangChain callbacks, trace     |
| `utils/langfuse.ts`              | 14                          | `langfuseStorage` export                          |
| `utils/langfuse.ts`              | 34-63                       | `startAgentTrace()` — root OTel observation       |
| `shared/utils/logger.ts`         | 93-131                      | `langfuse()` method — writes to active OTel span  |
| `shared/utils/logger.ts`         | 149-158                     | `telemetry()` method — cost/spans logging         |
| `shared/utils/logger.ts`         | 159-164                     | `agentActivity()` — mission-specific debug logging|
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
