===============================================================================
  Execution Layer — Core Agent Loop
===============================================================================
  Module    : Execution Layer
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Overview

Core agent execution loop patterns. These implement the actual LLM interaction
loop — streaming, tool calling, context management, and error recovery.

Depends on interfaces from `providers-tools/` and `state-session/`.

## Documents

| File                       | Description                                      |
|----------------------------|--------------------------------------------------|
| harness-pattern.md         | Core agent execution loop with NLAH harness      |
| strategy-pattern.md        | Agent execution mode factory (Standard, ReAct,   |
|                            | NLAH)                                            |
| anchor-pattern.md          | Context anchor system for LLM grounding          |
| circuit-breaker-           | Per-tool circuit breaker, bounded retry,         |
| pattern.md                 | strategy degradation, observation compression    |
| context-resolver-          | Intent classifier, topic registry, template     |
| pattern.md                 | injection, hybrid retrieval for >500 topics      |
| prompt-cache-              | Prefix-caching optimization for LLM KV cache    |
| optimization.md            | alignment across providers                       |

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
