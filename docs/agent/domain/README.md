================================================================================
  Domain Documentation
================================================================================
  Module    : Domain
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Overview

Domain layer documentation covering the agent tool definitions and prompt
engineering strategy used across all agent execution modes.

---

## Documentation Index

+------------------------------------------+------------------------------------------------------+
| Document                                 | Description                                          |
+------------------------------------------+------------------------------------------------------+
| tool-definitions.md                      | Tool schema, purpose, implementation for all tools   |
| prompt-engineering.md                    | Prompt compilation strategy, system prompt assembly, |
|                                          | prefix-caching optimization                          |
| memory-and-retrieval-strategy.md         | RAG vs fine-tuning analysis, hybrid search           |
|                                          | (BM25 + pgvector), gradual phases, context position, |
|                                          | history pruning trap                                 |
+------------------------------------------+------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
