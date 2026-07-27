================================================================================
  Strategy Pattern - Agent Execution Mode Factory
================================================================================
  Module    : Strategy Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Strategy factory pattern for agent execution modes. Each strategy implements
`AgentStrategy` with a single responsibility: building the system prompt. The
harness drives all execution loop logic.

---

## File Structure

```
strategies/
  constants.ts   # Strategy names and alias mappings
  factory.ts     # StrategyFactory dispatcher
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
   │ STRATEGY_MAPPINGS        │            │ else (default fallback)  │
   │  .STANDARD.includes      │            │                          │
   │     mode?                │            │                          │
   └───────┬──────────────────┘            └──────────┬───────────────┘
           │                                         │
           ▼                                         ▼
   ┌──────────────────────────┐            ┌──────────────────────────┐
   │  StandardStrategy        │            │  NLAHStrategy            │
   │  "standard"/"chat"       │            │  "agent"/"nlah"/        │
   │                          │            │  "deep-research"/       │
   │                          │            │  "react"/"sequential"   │
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
| Alias             | `chat`                 | `agent`, `nlah`, `deep-research`,        |
|                   |                        | `react`, `sequential`                    |
| Prompt style      | Minimal assistant      | NLAH coordinator                         |
| Tool usage        | None                   | Orchestrator + delegation                |
| Best for          | Simple Q&A             | Multi-agent research                     |
| Template vars     | None                   | `{tools}`, `{objective}`,               |
|                   |                        | `{workflow}`, `{delegation}`             |
+-------------------+------------------------+------------------------------------------+

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
| `NLAHStrategy`            | `nlah.ts`                                | `AgentStrategy` (active)                 |
| `StandardStrategy`        | `standard.ts`                            | `AgentStrategy` (legacy)                 |
| `STRATEGY_NAMES`          | `constants.ts`                           | `{ AGENT, STANDARD }`                   |
| `STRATEGY_MAPPINGS`       | `constants.ts`                           | Alias maps (AGENT → 5 aliases,          |
|                           |                                          | STANDARD → 2 aliases)                   |
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
| Factory dispatch logic   | `factory.ts:7-16`                        | STANDARD check → StandardStrategy, else NLAHStrategy|
| STRATEGY_MAPPINGS        | `constants.ts:6-9`                       | AGENT (5 aliases) and STANDARD (2 aliases)         |
| NLAH strategy            | `nlah.ts`                                | `buildSystemPrompt()` with 4 template variables    |
| NLAH workflow            | `prompts.ts:27-38`                       | Save → Plan → Delegate → Synthesize → Respond      |
| NLAH delegation          | `prompts.ts:40-48`                       | Max 3 concurrent sub-agents, 3 rounds              |
| NLAH researcher          | `prompts.ts:50-56`                       | 2-5 searches, keyword focus, reflection            |
+--------------------------+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
