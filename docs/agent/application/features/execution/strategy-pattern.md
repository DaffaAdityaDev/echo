================================================================================
  Strategy Pattern - Agent Execution Mode Factory
================================================================================
  Module    : Strategy Pattern
  Service   : agent
  Version   : 1.1
  Updated   : 2026-08-05 (versioned registry active; unknown version falls back to NLAH)
================================================================================

## Description

Strategy factory pattern for agent execution modes. Each strategy implements
`AgentStrategy` with a single responsibility: building the system prompt. The
harness drives all execution loop logic.

As of the Strategy Lifecycle roadmap (`docs/shared/patterns/strategy-lifecycle.md`),
strategies are **versioned** (`name:v1`) and registered in a metadata registry
(`registry.ts`) that answers "what is exported", while the Go gateway owns
operational control (active status, rollout %). [Active]

---

## File Structure

```
strategies/
  index.ts       # Public exports (StrategyFactory, strategyRegistry)
  factory.ts     # StrategyFactory — strategy instance constructor
  registry.ts    # StrategyRegistry — versioned metadata [Active]
  prompts.ts     # All prompt templates
  standard.ts    # Simple chat strategy [LEGACY]
  nlah.ts        # NLAH coordinator strategy [ACTIVE/PRIMARY]
```

---

## Flow Diagram

```
                  ┌──────────────────────────────────────┐
                  │     StrategyFactory.create(mode)      │
                  └────────────────┬─────────────────────┘
                                   │
                            mode.toLowerCase()
                                   │
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
   ┌──────────────────────────┐            ┌──────────────────────────┐
   │ factory checks           │            │ else (default fallback)  │
   │  ["standard","chat"].    │            │                          │
   │  includes(mode)?         │            │                          │
   └───────┬──────────────────┘            └──────────┬───────────────┘
           │                                         │
           ▼                                         ▼
   ┌──────────────────────────┐            ┌──────────────────────────┐
   │  StandardStrategy        │            │  NLAHStrategy            │
   │  "standard"/"chat"       │            │  "agent"/"deep-research"/│
   │                          │            │  "react"/"sequential"    │
   └──────────────────────────┘            └──────────────────────────┘
           │                                         │
           └──────────────────┬──────────────────────┘
                              │
                              ▼
              ┌────────────────────────────────────────┐
              │  return AgentStrategy {                 │
              │    name, buildSystemPrompt()            │
              │  }                                      │
              └────────────────┬───────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────────────┐
              │  Harness calls:                        │
              │  strategy.buildSystemPrompt(state,tools)│
              │  → compiled system prompt string       │
              │  → injected before provider.stream()   │
              └────────────────────────────────────────┘
```

### Strategy Lifecycle

```
     ┌────────────────────────────────────┐
     │   Harness:runMission()             │
     └────────────────┬───────────────────┘
                      │
                      ▼
     ┌─────────────────────────────────────────────────┐
     │  strategy.buildSystemPrompt(state, tools)        │
     │                                                  │
     │  {tools} sorted alphabetically  state.objective  │
     │                                                  │
     │  Template.replace()  ← prompts.ts constants      │
     │                                                  │
     │  Compiled system prompt string                   │
     │                                                  │
     │  prepend to messages[]                           │
     │                                                  │
     │  provider.stream(messages, tools, systemPrompt)  │
     └──────────────────────────────────────────────────┘
```

---

## Strategy Comparison

+-------------------+------------------------+------------------------------------------+
| Aspect            | Standard [LEGACY]      | NLAH ("agent" mode) [ACTIVE]             |
+-------------------+------------------------+------------------------------------------+
| Alias             | `chat`                 | `agent`, `deep-research`,                |
|                   |                        | `react`, `sequential`                    |
| Prompt style      | Minimal assistant      | NLAH coordinator                         |
| Tool usage        | None                   | Orchestrator + delegation                |
| Best for          | Simple Q&A             | Multi-agent research                     |
| Template vars     | None                   | `{tools}`, `{objective}`,               |
|                   |                        | `{workflow}`, `{delegation}`             |
+-------------------+------------------------+------------------------------------------+

---

## Strategy Registry & Versioning `[Active]`


Versioned metadata layer over `StrategyFactory`. Registry is the **code-side
source of truth** ("what is exported"); it does not decide rollout — the Go
gateway does (settings table). `StrategyFactory` remains the only constructor
of strategy instances; the registry maps version strings back to it.

```
┌──────────────────────────────────────────────────────────────┐
│ StrategyRegistry (registry.ts) — code truth                  │
│  StrategyRegistryEntry:                                      │
│   name: 'nlah' | 'standard'                                  │
│   versions: [{ version: 'nlah:v1', status, aliases[] }]      │
│  resolve(version: 'nlah:v1') -> AgentStrategy                │
│    (delegates to StrategyFactory.create(name))               │
└──────────────────────────────┬───────────────────────────────┘
                               │ GET /api/strategies
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Go Gateway — operational truth (settings table)              │
│  { "deep_research:v1": { "rollout": 0.2 } }                  │
│  resolveStrategyVersion(sessionPin, rollout) -> 'nlah:v1'    │
└──────────────────────────────────────────────────────────────┘
```

### Registered Versions (initial)

| Version          | Strategy  | Status     | Aliases                              |
|------------------|-----------|------------|--------------------------------------|
| `standard:v1`    | Standard  | active     | `chat`                               |
| `nlah:v1`        | NLAH      | active     | `agent`, `deep-research`, `react`,   |
|                  |           |            | `sequential`                         |

Note: `"nlah"` itself is NOT an alias — aliases come from
`STRATEGY_VERSION_ALIASES` (`strategies/constants.ts:11-14`). The mission
schema's `STRATEGY_MAPPING` (`mission.constants.ts:10-13`) additionally maps
the raw `strategy` field (`"nlah"`, `"react"`, …) to the `agent` strategy
before `strategy_version` is resolved.

### Versioning Contract

- Format: `{name}:v{n}` — never overwrite a version in place; new behavior
  ships as `{name}:v2`.
- `status`: `active` | `deprecated`. Deprecated versions remain executable for
  sessions that pinned them (backward compatibility), but are excluded from
  new-session resolution.
- **Unknown version fallback**: `strategyRegistry.resolve()` performs NO
  validation — an unrecognized version/alias falls through to
  `StrategyFactory.create(normalized)`, which returns `NLAHStrategy` for any
  mode that is not `standard`/`chat`. The Go gateway validates versions
  before they reach the agent.
- Session pin: the gateway stores the chosen version on `sessions.strategy_version`
  (immutable per session) — active sessions keep their version until finished.
- Rollout: gateway maps a deterministic fraction of *new* sessions to a new
  version via rollout % (canary); sessions never migrate mid-flight.
- Sunset: 3 phases — soft deprecation (hidden from UI, executable),
  zero-traffic alarm, decommission (registry removal after sessions drain).
  Full contract in `docs/shared/patterns/strategy-lifecycle.md`.

---

## Prompt Templates

### Standard (`prompts.ts:2`)
```
"You are Echo, a helpful AI assistant. Answer the user's question directly and concisely."
```

### NLAH (`prompts.ts:59-84`) — internal driver for "agent" mode
```
"You are Echo, a Coordinator Parent Agent operating under the NLAH framework.
{workflow}
{delegation}
CORE PROTOCOLS: 1. Orchestrator Only 2. In-State Planning 3. Clear Validation 4. Durable State
AVAILABLE ORCHESTRATION TOOLS:
{tools}
OBJECTIVE: {objective}"
```

---

## Entry Points & Exports

+---------------------------+------------------------------------------+------------------------------------------+
| Export                    | Source                                   | Type                                     |
+---------------------------+------------------------------------------+------------------------------------------+
| `StrategyFactory`         | `factory.ts`                             | Static factory with `create()`           |
| `StrategyRegistry`        | `registry.ts`                            | Versioned registry (resolve, catalog)   |
| `NLAHStrategy`            | `nlah.ts`                                | `AgentStrategy` (active)                 |
| `StandardStrategy`        | `standard.ts`                            | `AgentStrategy` (legacy)                 |
| `STRATEGY_NAMES`          | `constants.ts`                           | `{ AGENT, STANDARD }`                   |
| `STRATEGY_VERSION_ALIASES`| `constants.ts`                           | Version alias maps (standard:v1 → chat, |
|                           |                                          | nlah:v1 → agent/deep-research/react/sequential) |
| `STRATEGY_MAPPING`        | `adapter/inbound/api/missions/mission.constants.ts:10-13` | Raw strategy field → standard/agent mapping |
| `STRATEGY_VERSIONS`       | `constants.ts`                           | `{ standard: "standard:v1", nlah: "nlah:v1" }` |
| `STANDARD_PROMPTS`        | `prompts.ts`                             | Standard prompt template                 |
| `NLAH_PROMPTS`            | `prompts.ts`                             | NLAH system template                     |
| `NLAH_INSTRUCTIONS`       | `prompts.ts`                             | Workflow, delegation, researcher instr.  |
+---------------------------+------------------------------------------+------------------------------------------+

---

## Dependencies

+------------------+--------------------------------------------------------------+
| Dependency       | Purpose                                                      |
+------------------+--------------------------------------------------------------+
| `shared/types`   | `AgentStrategy`, `AgentState`, `ToolDefinition`              |
| `strategies/constants.ts` | Name mappings                                       |
+------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+----------------------------------------------------+
| Ref                      | File                                     | Key Lines                                          |
+--------------------------+------------------------------------------+----------------------------------------------------+
| Factory dispatch logic   | `factory.ts:5-9`                        | ["standard","chat"] check → StandardStrategy, else NLAHStrategy|
| STRATEGY_VERSION_ALIASES | `constants.ts:11-14`                    | nlah:v1 → agent/deep-research/react/sequential; standard:v1 → chat |
| NLAH strategy            | `nlah.ts`                                | `buildSystemPrompt()` with 4 template variables    |
| NLAH workflow            | `prompts.ts:27-38`                       | Save → Plan → Delegate → Synthesize → Respond      |
| NLAH delegation          | `prompts.ts:40-48`                       | Max 3 concurrent sub-agents, 3 rounds              |
| NLAH researcher          | `prompts.ts:50-56`                       | 2-5 searches, keyword focus, reflection            |
| Strategy registry        | `registry.ts:20-58` [Active]             | Versioned catalog; resolve() falls back to NLAH    |
| Lifecycle contract       | `docs/shared/patterns/strategy-lifecycle.md` | Versioning, canary, sunset rules            |
+--------------------------+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
