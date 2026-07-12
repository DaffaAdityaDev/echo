===============================================================================
  Skills System - Behavioral Patterns for Agent Execution
===============================================================================
  Module    : Skills System
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Description

A Skill is a behavioral pattern consisting of a static system prompt and optional
tool preferences that guide how the agent approaches a task. Skills sit above
strategies and tools — they influence prompt compilation by injecting
role-specific instructions, reasoning protocols, and preferred tool sets
into the system prompt.

There is no template system — `systemPrompt` is a plain string. Compilation is
a simple concatenation of all active skills' prompts with a `[skillName mode]`
header prefix.

---

## Concepts

```
Skill        = behavioral pattern (static system prompt + tool preferences)
Strategy     = execution loop mode (Standard, ReAct, NLAH)
Tool         = concrete action (web_search, write_todos, etc.)
─────────────────────────────────────────────────────────────────
Skill         → influences HOW the agent thinks and what it prefers
Strategy      → determines the execution loop mechanics
Tool          → what the agent CAN DO
```

---

## Architecture Position

```
                    ┌─────────────────────────────────────┐
                    │        Session Config                │
                    │  { skills: ["research"],            │
                    │    features: ["web_search"], ... }  │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────▼──────────────────┐
                    │      Mission Controller              │
                    │                                     │
                    │  1. If features[] explicitly set:    │
                    │     resolveTools(features) only      │
                    │     (preferredTools IGNORED)          │
                    │  2. If features[] NOT set + skills:  │
                    │     new SkillRegistryImpl()          │
                    │     getSkill() → preferredTools[]    │
                    │     resolveTools(preferredTools)     │
                    │  3. Pass resolved tools to harness   │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌───────────────────▼───────────────────┐
                    │      Harness.runMission()              │
                    │                                       │
                    │  if explicitTools?.length > 0:         │
                    │    tools = explicitTools               │
                    │  else:                                 │
                    │    tools = ToolRetriever(keyword match)│
                    │    ← only relevant tools from full pool│
                    │                                       │
                    ├── Prompt Compilation ─────────────────┤
                    │  1. strategy.buildSystemPrompt()       │
                    │  2. compileSkillPrompts() → appends    │
                    │     "[name]" + systemPrompt per skill  │
                    │  3. = Final system prompt              │
                    ├── LLM Call ───────────────────────────┤
                    │  provider.stream(messages,             │
                    │    tools,                              │
                    │    compiledSystemPrompt)               │
                    └───────────────────────────────────────┘
```

---

## Skill Injection in Harness Loop

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                     MissionController.createMission()                │
  │                                                                     │
  │  1. Session config: { skills: ["analyst"],                          │
  │                       features: ["web_search"] }                    │
  │                                                                     │
  │  2. Controller resolves tools:                                      │
  │     a) features !== undefined → resolveTools(features)              │
  │        (skill preferredTools ignored entirely)                       │
  │     b) features === undefined + skills present →                    │
  │        new SkillRegistryImpl() → getSkill("analyst")                │
  │        resolveTools(preferredTools)                                  │
  │     c) Pass resolved tools to AgentHarness                           │
  │                                                                     │
  │  3. Harness.runMission():                                           │
  │     a) Store explicitTools (from controller)                        │
  │     b) static skillRegistry.compileSkillPrompts() → append prompts  │
  │     c) static skillRegistry.compileModifiers() → toggle:            │
  │        compression, pacing, loopDetection                           │
  │     d) provider.stream(messages, explicitTools, compiledSystemPrompt│
  │                                                                     │
  │  4. Model response influenced by:                                   │
  │     - Skill persona (via static systemPrompt injection)             │
  │     - Tool availability (features XOR preferredTools, never merged) │
  │                                                                     │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Standard Library

+-----------------+------------------------------------------------+------------------------------------------+
| Skill           | Description                                    | Preferred Tools                          |
+-----------------+------------------------------------------------+------------------------------------------+
| **Reasoning**   | Step-by-step logical reasoning, problem        | `web_search`, `write_todos`              |
|                 | decomposition, chain-of-thought protocol       |                                          |
+-----------------+------------------------------------------------+------------------------------------------+
| **Coding**      | Code generation, debugging, code review,       | `web_search`                             |
|                 | software architecture decisions                |                                          |
+-----------------+------------------------------------------------+------------------------------------------+
| **Research**    | Multi-source investigation, deep-dive          | `web_search`, `delegate_task`            |
|                 | analysis, citation tracking                    |                                          |
+-----------------+------------------------------------------------+------------------------------------------+
| **Planning**    | Task decomposition, milestone planning,        | `write_todos`, `delegate_task`           |
|                 | dependency mapping, execution tracking         |                                          |
+-----------------+------------------------------------------------+------------------------------------------+
| **Analyst**     | Data analysis, pattern recognition,            | `web_search`                             |
|                 | statistical reasoning, insight extraction      |                                          |
+-----------------+------------------------------------------------+------------------------------------------+

Each skill also carries optional `modifiers` (temperature, maxTokens, compression,
pacing, loopDetection) consumed at runtime by `compileModifiers()`.

---

## Custom Skills

Users can define custom skills in their session config:

```typescript
interface SkillDefinition {
  name: string;                              // Unique skill identifier
  description: string;                       // For documentation/debugging
  systemPrompt: string;                      // Static string injected into system prompt
  preferredTools?: string[];                 // Tools suggested when features not set
  allowedTools?: string[];                   // Defined but NOT used at runtime (dead field)
  modifiers?: {
    temperature?: number;
    maxTokens?: number;
    compression?: boolean;                   // Toggle context compaction in harness
    pacing?: boolean;                        // Toggle cognitive pacing warning injection
    loopDetection?: boolean;                 // Toggle semantic similarity loop detection
  };
}

// Example custom skill
{
  name: "customer_support",
  description: "Handles customer inquiries with empathy and accuracy",
  systemPrompt: `You are a customer support specialist.
Always follow these protocols:
1. Acknowledge the customer's issue
2. Gather necessary information
3. Provide clear, actionable solutions
4. Confirm resolution`,
  preferredTools: ["search_kb", "ticket_lookup"],
}
```

---

## Skill Definition Schema

```typescript
interface SkillDefinition {
  name: string;
  description: string;
  systemPrompt: string;              // Static string (NOT a template)
  preferredTools?: string[];         // Tools used when features are not explicitly set
  allowedTools?: string[];           // Defined in interface but dead at runtime — never enforced
  modifiers?: {
    temperature?: number;            // Ready for LLM provider call (not yet consumed)
    maxTokens?: number;              // Ready for LLM provider call (not yet consumed)
    compression?: boolean;           // Toggle context compaction in NlahHarness
    pacing?: boolean;                // Toggle cognitive pacing in NlahHarness
    loopDetection?: boolean;         // Toggle semantic loop detection in NlahHarness
  };
}

interface SkillRegistry {
  getSkill(name: string): SkillDefinition | undefined;
  getAllSkills(): SkillDefinition[];
  registerSkill(skill: SkillDefinition): void;
  registerCustomSkill(skill: SkillDefinition): void;
}
```

There is no `SkillCompiler` class. Prompt compilation is done by
`SkillRegistryImpl.compileSkillPrompts()` which simply concatenates:

```
"[skillName mode]" + systemPrompt
```

for each active skill, separated by double newlines.

---

## Prompt Compilation Order

```
  Final System Prompt Construction:

  1. [Strategy System Prompt]     ← strategy.buildSystemPrompt(state, tools)
  2. [Skill System Prompts]       ← compileSkillPrompts() — "[name]" + systemPrompt per skill

  Result:
  ┌────────────────────────────────────────────────────────────────┐
  │  [NLAH Framework Instructions]                                 │
  │                                                               │
  │  [reasoning mode]                                             │
  │  You should approach this step-by-step...                      │
  │                                                               │
  │  [research mode]                                              │
  │  Conduct thorough research by searching multiple sources...    │
  └────────────────────────────────────────────────────────────────┘
```

---

## Modifiers (compileModifiers)

`SkillRegistryImpl.compileModifiers(activeSkills)` merges each skill's
`modifiers` object into a single record, then applies them in harness:

| Modifier        | Type      | Effect                                                   |
|-----------------|-----------|----------------------------------------------------------|
| compression     | boolean   | `if (false) → disable context compaction`                |
| pacing          | boolean   | `if (false) → disable cognitive pacing threshold`        |
| loopDetection   | boolean   | `if (false) → disable semantic cosine-similarity check`  |
| temperature     | number    | Declared — ready for LLM provider call integration       |
| maxTokens       | number    | Declared — ready for LLM provider call integration       |

In NlahHarness (line 168–170):
```typescript
if (modifiers.compression === false) this.compressionEnabled = false;
if (modifiers.pacing === false) this.pacingEnabled = false;
if (modifiers.loopDetection === false) this.loopDetectionEnabled = false;
```

---

## Dual SkillRegistryImpl Instances

There are two separate `SkillRegistryImpl` instances in the codebase:

| Instance         | Location                                          | Purpose                         |
|------------------|---------------------------------------------------|---------------------------------|
| Controller-local | `mission.controller.ts:95`                        | Tool resolution (preferredTools)|
| Harness-static   | `harness.ts:44` `private static skillRegistry`    | Prompt + modifier compilation   |

They are **not shared** — each is constructed independently.
The controller instance is ephemeral (created per-request at line 95).
The harness instance is a static field on `NlahHarness`, persistent for
the class lifetime.

---

## API Endpoint

Skills are served via `GET /api/skills`. The endpoint returns a filtered view:

```typescript
// skills.routes.ts — response shape
standardSkills.map(s => ({
  name: s.name,
  description: s.description,
  preferredTools: s.preferredTools,
  modifiers: s.modifiers,
}))
```

The following fields are **excluded** from the API response:
- `systemPrompt` — internal prompt text, not exposed externally
- `allowedTools` — dead field, has no runtime effect

Backend fetches this **only when** `skills[]` is present in the chat
request — if not sent, the fetch is skipped, avoiding unnecessary HTTP
calls.

```
Backend receives skills: ["research"]
  → GET /api/skills (agent, cached Redis 10m)  ← only if skills[] present
  → validate "research" exists
  → forward skills[] to agent
  → agent resolves preferredTools or uses features (never merged)
```

---

## Dependencies

+----------------------+--------------------------------------------------------------+
| Dependency           | Purpose                                                      |
+----------------------+--------------------------------------------------------------+
| `shared/types`       | `AgentStrategy` (composes with skill prompt)                 |
| `ToolRegistry`       | Resolve feature/preferred-tool names to ToolDefinition[]     |
| `zod`                | Skill config validation                                      |
+----------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+------------------------------------------+------------------------------------------+
| Ref                        | File                                      | Key Lines                                |
+----------------------------+------------------------------------------+------------------------------------------+
| SkillRegistryImpl          | `core/agent/skills/registry.ts`           | `getSkill()`, `registerSkill()`,         |
|                            |                                          | `registerCustomSkill()`                  |
| Standard library           | `core/agent/skills/library.ts`            | 5 predefined skills with systemPrompt,   |
|                            |                                          | preferredTools, modifiers                |
| compileSkillPrompts()      | `core/agent/skills/registry.ts:30`        | Concatenates static systemPrompt strings |
| compileModifiers()         | `core/agent/skills/registry.ts:42`        | Merges modifier flags from skills        |
| Harness integration        | `core/agent/harness/nlah/harness.ts`      | Static skillRegistry instance,           |
|                            |                                          | compileSkillPrompts + compileModifiers   |
| Controller instance        | `app/api/missions/mission.controller.ts`  | Ephemeral SkillRegistryImpl at line 95   |
| Controller tool resolution | `app/api/missions/mission.controller.ts`  | features XOR preferredTools (lines 88-110)|
| Mission schema             | `app/api/missions/mission.schema.ts`      | `skills` array + `features` array        |
| Skills API endpoint        | `app/api/skills/skills.routes.ts`         | Filters response to 4 fields (line 8-13) |
+----------------------------+------------------------------------------+------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
