================================================================================
  Anchor Pattern - Context Anchor System
================================================================================
  Module    : Anchor Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Context anchor system that injects a standardized `<context_anchor>` system
message at the beginning of every agent conversation. Provides temporal
grounding to the LLM.

---

## File Structure

```
anchors/
  constants.ts   # Version names, templates
  standard.ts    # StandardContextAnchor implementation
```

---

## Flow Diagram

```
    ┌─────────────────────────────────────────────────────────────────┐
    │           Mission Start (Controller / Delegation)               │
    └──────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
│  StandardContextAnchor()                                          │
│    → new StandardContextAnchor()                                 │
│    → anchor.build(options?)                                      │
    │                                                              │
    │  options.year    || new Date().getFullYear()                 │
    └──────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  LangChain SystemMessage:                                        │
    │  <context_anchor>Current_Year: 2026</context_anchor>             │
    └──────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  Prepend to state.messages[0]                                    │
    │  [anchor, ...historyMessages, new HumanMessage(prompt)]          │
    │                                                                  │
    │  Passed to provider.stream() as first message                    │
    └─────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+--------------------------+-----------------------------+---------------------------------------------+
| Export                   | Source                      | Type                                        |
+--------------------------+-----------------------------+---------------------------------------------+
| `StandardContextAnchor`  | `standard.ts`                | Default implementation with `build(options?)`|
| `StandardContextAnchor`  | `standard.ts`               | Default implementation                      |
| `ANCHOR_VERSIONS`        | `constants.ts`              | Version constants                           |
+--------------------------+-----------------------------+---------------------------------------------+

---

## Dependencies

+---------------------------------+--------------------------------------------------------------+
| Dependency                      | Purpose                                                      |
+---------------------------------+--------------------------------------------------------------+
| `@langchain/core/messages`      | `SystemMessage`                                              |
| `anchors/constants.ts`          | Template strings                                             |
+---------------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+----------------------------------------+----------------------------------------------------+
| Ref                        | File                                   | Key Lines                                          |
+----------------------------+----------------------------------------+----------------------------------------------------+
| Standard anchor            | `standard.ts:4-8`                     | Builds with year                               |
| Template                   | `constants.ts:5-7`                   | `<context_anchor>Current_Year...` format        |
| Usage in controller        | `mission.controller.ts`                | `new StandardContextAnchor().build()` prepended |
| Usage in delegation        | `delegation/index.ts:74`               | Same pattern for sub-agent state initialization    |
+----------------------------+----------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
