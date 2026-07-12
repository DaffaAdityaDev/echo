================================================================================
  Prompt Engineering - Prompt Compilation and Optimization
================================================================================
  Module    : Prompt Engineering
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The agent service uses a **static-first, suffix-dynamic** prompt assembly strategy
optimized for LLM prefix caching. The system prompt is composed of a static
template with runtime variables (`{tools}`, `{objective}`, `{workflow}`,
`{delegation}`) substituted at the end, ensuring the prefix remains cacheable
across requests. Three strategy profiles exist: Standard (simple chat), ReAct
(reasoning + acting), and NLAH (coordinator-based orchestration, powers Iterative Agent mode).

---

## File Structure

```
src/core/agent/strategies/
  prompts.ts              # All prompt templates: STANDARD, REACT, NLAH
  constants.ts            # Strategy names and alias mappings
  standard.ts             # StandardStrategy (legacy)
  re-act.ts               # ReActStrategy (legacy)
  nlah.ts                 # NLAHStrategy (primary production)
  factory.ts              # StrategyFactory: selects strategy by mode
```

---

## Prompt Assembly Strategy

### Static-First / Suffix-Dynamic Pattern

All templates place variable substitutions at the **end of the prompt**, after
all static instruction content. This maximizes LLM prefix cache hits across
requests.

```
┌──────────────────────────────────────────────────────────────────────┐
│  STATIC PREFIX (cacheable)                                            │
│  - Agent identity: "You are Echo..."                                  │
│  - Rule definitions                                                   │
│  - Workflow instructions (NLAH)                                       │
│  - Delegation protocol (NLAH)                                        │
├──────────────────────────────────────────────────────────────────────┤
│  DYNAMIC SUFFIX (per-request)                                         │
│  - {tools}       → sorted tool descriptions                          │
│  - {objective}   → user prompt                                       │
│  - {workflow}    → RESEARCH_WORKFLOW                                 │
│  - {delegation}  → SUBAGENT_DELEGATION                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Anthropic Cache Control

In the `AnthropicProvider`, the last tool definition is marked with ephemeral
`cache_control` to freeze the tool schema in Anthropic's cluster cache:

```typescript
tools.map((t, idx) => ({
  ...t,
  ...(idx === tools.length - 1 && { cache_control: { type: "ephemeral" } })
}));
```

---

## Strategy Profiles

### 1. Standard Strategy (Legacy)

+------------------+----------------------------------------------------+
| Property         | Value                                              |
+------------------+----------------------------------------------------+
| File             | `src/core/agent/strategies/standard.ts`            |
| Status           | **LEGACY / REFERENCE ONLY**                        |
| Prompt           | `STANDARD_PROMPTS.STANDARD_SYSTEM`                |
+------------------+----------------------------------------------------+

```
"You are Echo, a helpful AI assistant. Answer the user's question directly
and concisely."
```

No variable substitution. Single-shot chat.

### 2. ReAct Strategy (Legacy)

+------------------+----------------------------------------------------+
| Property         | Value                                              |
+------------------+----------------------------------------------------+
| File             | `src/core/agent/strategies/re-act.ts`              |
| Status           | **LEGACY / REFERENCE ONLY**                        |
| Template         | `REACT_PROMPTS.REACT_SYSTEM`                       |
+------------------+----------------------------------------------------+

**Template structure:**
```
<agent_config>
You are Echo, an autonomous ReAct executor. Solve the objective step-by-step.

<rules>
1. THOUGHT: Reason directly about the next required step.
2. TOOL CALL: If external data or action is needed, call exactly ONE tool.
3. FINAL ANSWER: If data is sufficient, output final answer directly.
4. If a tool fails, adapt strategy and try an alternative tool.
</rules>

<available_tools>
{tools}               <-- DYNAMIC: sorted tool descriptions
</available_tools>

<objective>
{objective}            <-- DYNAMIC: user prompt
</objective>
</agent_config>
```

### 3. NLAH Strategy (Primary Production) — internal harness for "agent" mode

+------------------+----------------------------------------------------+
| Property         | Value                                              |
+------------------+----------------------------------------------------+
| File             | `src/core/agent/strategies/nlah.ts`                |
| Status           | **ACTIVE / PRIMARY**                               |
| Template         | `NLAH_PROMPTS.SYSTEM_TEMPLATE`                    |
+------------------+----------------------------------------------------+

**Template structure:**
```
You are Echo, a Coordinator Parent Agent operating under NLAH framework.

{workflow}             <-- DYNAMIC: RESEARCH_WORKFLOW_INSTRUCTIONS
{delegation}           <-- DYNAMIC: SUBAGENT_DELEGATION_INSTRUCTIONS

CORE PROTOCOLS:
1. Orchestrator Only
2. In-State Planning (write_todos)
3. Clear Validation
4. Durable State (STATE.md)

AVAILABLE ORCHESTRATION TOOLS:
{tools}                <-- DYNAMIC: sorted tool descriptions

OBJECTIVE: {objective} <-- DYNAMIC: user prompt
```

### NLAH Sub-prompts

+----------------------------------+---------------------------------------------------+
| Prompt Constant                  | Key Instructions                                  |
+----------------------------------+---------------------------------------------------+
| `NLAH_INSTRUCTIONS.RESEARCH_WORKFLOW` | Save → Plan with TODOs → Delegate → Synthesize → Respond |
| `NLAH_INSTRUCTIONS.SUBAGENT_DELEGATION` | Coordinator-only, max 3 concurrent sub-agents, 3 rounds |
| `NLAH_INSTRUCTIONS.RESEARCHER`   | Sub-agent role: keywords, 2-5 searches, findings |
+----------------------------------+---------------------------------------------------+

---

## Strategy Factory

```typescript
StrategyFactory.create(mode: string): AgentStrategy
```

+------------------------+------------------+------------------+
| Input Mode(s)          | Strategy         | Status           |
+------------------------+------------------+------------------+
| `'react'`              | `ReActStrategy`  | Legacy           |
| `'agent'`, `'nlah'`, `'deep-research'`| `NLAHStrategy`| Production       |
| `'standard'`, `'chat'` | `StandardStrategy`| Legacy          |
| `'sequential'`         | `StandardStrategy`| Legacy (normalized by mission.schema.ts preprocessor; falls to default in factory) |
+------------------------+------------------+------------------+

---

## Dependencies

+--------------------------------------+---------------------------------------------------+
| Dependency                           | Usage                                             |
+--------------------------------------+---------------------------------------------------+
| `AgentStrategy` (shared/types)       | Interface for strategy pattern                    |
| `AgentState`, `ToolDefinition`       | Input types for prompt construction               |
+--------------------------------------+---------------------------------------------------+

---

## Source References

+----------------------------------------+-----------------------------+---------------------------------------------------+
| File                                   | Line                        | Description                                       |
+----------------------------------------+-----------------------------+---------------------------------------------------+
| `strategies/prompts.ts`                | 1-70                        | All prompt templates (STANDARD, REACT, NLAH)      |
| `strategies/prompts.ts`                | 6-23                        | REACT_SYSTEM template with tools/objective slots  |
| `strategies/prompts.ts`                | 26-51                       | NLAH workflow, delegation, researcher instructions|
| `strategies/prompts.ts`                | 53-70                       | NLAH SYSTEM_TEMPLATE with 4 variable slots        |
| `strategies/constants.ts`              | 1-11                        | Strategy name constants and alias mappings        |
| `strategies/nlah.ts`                   | 18-33                       | NLAHStrategy.buildSystemPrompt assembles variables |
| `strategies/re-act.ts`                 | 17-29                       | ReActStrategy.buildSystemPrompt — 2 variables     |
| `strategies/standard.ts`               | 14-19                       | StandardStrategy — static prompt only             |
| `strategies/factory.ts`                | 7-23                        | Strategy selection by mode string                 |
| `adapter/llm/anthropic.adapter.ts`            | 41-47                | Cache control on last tool definition             |
+----------------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
