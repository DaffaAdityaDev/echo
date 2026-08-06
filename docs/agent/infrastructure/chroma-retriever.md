================================================================================
  Tool Retriever - Keyword-Based Tool Relevance Retrieval (ChromaDB planned)
================================================================================
  Module    : Tool Retriever
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The `ToolRetriever` class implements a lightweight, in-memory keyword-and-description
scoring system to select the most relevant tools for a given user prompt. It is
**not** a vector database retriever (no ChromaDB client is used at runtime);
instead, it provides deterministic, zero-dependency tool selection with a fallback
mechanism.

> **Planned Enhancement:** `CHROMA_URL` is declared in `config/env.schema.ts` for
> future ChromaDB-powered semantic retrieval, but no vector client is implemented yet.
> The current runtime uses only the keyword-based `ToolRetriever`.

---

## File Structure

```
src/core/agent/services/
  index.ts                   # Barrel — re-exports ToolRetriever + constants
  retriever.ts               # ToolRetriever class
  constants.ts               # Scoring weights & config
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             User Prompt                                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│           ToolRetriever.getRelevantTools(prompt, allTools, limit=8)       │
│                                                                           │
│  For each tool in allTools:                                              │
│                                                                           │
│  ┌─ Keyword matching (weight 0.6)                                        │
│  │   prompt.includes(keyword) → score += 0.6                             │
│  │                                                                        │
│  ┌─ Description matching (weight 0.3)                                    │
│  │   prompt in desc OR desc in prompt → score += 0.3                     │
│  │                                                                        │
│  ┌─ Name matching (weight 0.1)                                           │
│  │   prompt in name OR name in prompt → score += 0.1                     │
│                                                                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Scored tools list                                                        │
│                                                                           │
│  ├─ Filter: score > 0                                                    │
│  ├─ Sort: descending by score                                            │
│  └─ Slice: top N (default 8)                                             │
│                                                                           │
│  matched.length > 0 ?                                                     │
│    ┌─ YES → Return top tools (sliced to limit)                           │
│    └─ NO  → Fallback: filter allTools to those whose name is in           │
│             RETRIEVER_FALLBACK_TOOLS (empty — returns []; strict           │
│             allowlist: no tool is enabled implicitly)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+----------------------------+--------+---------------------------------------------------+
| Export                     | Type   | Description                                       |
+----------------------------+--------+---------------------------------------------------+
| `ToolRetriever`            | class  | No constructor — stateless; `getRelevantTools()`  |
| `RETRIEVER_CONFIG`         | const  | `{ DEFAULT_LIMIT: 8, MIN_MATCH_SCORE: 0 }`       |
| `MATCH_WEIGHTS`            | const  | `{ KEYWORD: 0.6, DESCRIPTION: 0.3, NAME: 0.1 }`  |
| `RETRIEVER_FALLBACK_TOOLS` | const  | `[]` — empty; no implicit tool fallback (strict allowlist) |
+----------------------------+--------+---------------------------------------------------+

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Usage                                                        |
+----------------------------------+--------------------------------------------------------------+
| `ToolDefinition` (shared/types)  | Input type for the tool list                                 |
| `constants.ts`                   | Weights, limits, fallback configuration                      |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+-----------------------------+-----------------------------+---------------------------------------------------+
| File                        | Line                        | Description                                       |
+-----------------------------+-----------------------------+---------------------------------------------------+
| `retriever.ts`              | 4-54                        | `ToolRetriever` — no constructor, no index state  |
| `retriever.ts`              | 8-54                        | `getRelevantTools()` — full scoring and selection |
| `retriever.ts`              | 48-51                       | Fallback — filters `allTools` by name; can return [] |
| `constants.ts`    | 1-4                         | `RETRIEVER_CONFIG` — default limit and min score  |
| `constants.ts`    | 6-10                        | `MATCH_WEIGHTS` — per-scoring-category weights    |
| `constants.ts`    | 12                          | `RETRIEVER_FALLBACK_TOOLS` — fallback name filter |
+-----------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
