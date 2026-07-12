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
  retriever.ts               # ToolRetriever class
  retriever.constants.ts     # Scoring weights & config
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
│    ┌─ YES → Return top tools                                             │
│    └─ NO  → Fallback: return only ['web_search']                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+----------------------------+--------+---------------------------------------------------+
| Export                     | Type   | Description                                       |
+----------------------------+--------+---------------------------------------------------+
| `ToolRetriever`            | class  | Constructor takes `ToolDefinition[]`              |
| `RETRIEVER_CONFIG`         | const  | `{ DEFAULT_LIMIT: 8, MIN_MATCH_SCORE: 0 }`       |
| `MATCH_WEIGHTS`            | const  | `{ KEYWORD: 0.6, DESCRIPTION: 0.3, NAME: 0.1 }`  |
| `RETRIEVER_FALLBACK_TOOLS` | const  | `['web_search']` — fallback when no match         |
+----------------------------+--------+---------------------------------------------------+

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Usage                                                        |
+----------------------------------+--------------------------------------------------------------+
| `ToolDefinition` (shared/types)  | Input type for the tool list                                 |
| `retriever.constants.ts`         | Weights, limits, fallback configuration                      |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+-----------------------------+-----------------------------+---------------------------------------------------+
| File                        | Line                        | Description                                       |
+-----------------------------+-----------------------------+---------------------------------------------------+
| `retriever.ts`              | 4-9                         | Class constructor, tool list storage              |
| `retriever.ts`              | 11-13                       | `updateIndex()` — replaces tool list              |
| `retriever.ts`              | 18-64                       | `getRelevantTools()` — full scoring and selection |
| `retriever.constants.ts`    | 1-4                         | `RETRIEVER_CONFIG` — default limit and min score  |
| `retriever.constants.ts`    | 6-10                        | `MATCH_WEIGHTS` — per-scoring-category weights    |
| `retriever.constants.ts`    | 12                          | `RETRIEVER_FALLBACK_TOOLS` — fallback when none   |
+-----------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
