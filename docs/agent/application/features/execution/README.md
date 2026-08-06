===============================================================================
  Execution Layer — Core Agent Loop
===============================================================================
  Module    : Execution Layer
  Service   : agent
  Version   : 1.1
  Updated   : 2026-07-31 (planned: versioned strategy registry)
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
|                            | NLAH) + versioned registry [Active]              |
| anchor-pattern.md          | Context anchor system for LLM grounding          |
| circuit-breaker-pattern.md | Per-tool circuit breaker, bounded retry,         |
|                            | strategy degradation, observation compression    |
| context-resolver-pattern.md| Intent classifier, topic registry, template     |
|                            | injection, hybrid retrieval for >500 topics      |
| prompt-cache-optimization.md | Prefix-caching optimization for LLM KV cache   |
|                            | alignment across providers                       |

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
