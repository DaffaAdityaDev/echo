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
message at the beginning of every agent conversation. Provides temporal and
locational grounding to the LLM.

---

## File Structure

```
anchors/
  types.ts       # IContextAnchor interface
  constants.ts   # Version names, defaults, templates
  factory.ts     # AnchorFactory.create()
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
    │  AnchorFactory.create()                                          │
    │    → default  (future versions → extensible)                    │
    │    → new StandardContextAnchor()                                 │
    │    → anchor.build(options?)                                      │
    │                                                                  │
    │  options.location || 'South Jakarta' (default)                   │
    │  options.year    || new Date().getFullYear()                     │
    └──────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  LangChain SystemMessage:                                        │
    │  <context_anchor>Current_Year: 2026 |                            │
    │  Session_Start_Location: South Jakarta</context_anchor>          │
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
| `AnchorFactory`          | `factory.ts`                | Static factory with `create(version?)`      |
| `IContextAnchor`         | `types.ts`                  | `build(options?)` interface                 |
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
| Factory                    | `factory.ts:6-12`                      | Switch on version (defaults to `standard`)         |
| Interface                  | `types.ts:3-5`                         | `IContextAnchor.build(options?)` returns SysMsg    |
| Standard anchor            | `standard.ts:6-12`                     | Builds with location/year                          |
| Template                   | `constants.ts:10-11`                   | `<context_anchor>Current_Year...` format           |
| Defaults                   | `constants.ts:6-7`                     | Location: 'South Jakarta'                          |
| Usage in controller        | `mission.controller.ts:77`             | `AnchorFactory.create().build()` prepended         |
| Usage in delegation        | `delegation/index.ts:74`               | Same pattern for sub-agent state initialization    |
+----------------------------+----------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
