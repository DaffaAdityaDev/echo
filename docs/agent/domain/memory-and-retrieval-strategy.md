===============================================================================
  Memory & Retrieval Strategy - RAG vs Fine-tuning Decision Record
===============================================================================
  Module    : Memory & Retrieval Strategy
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Description

Architecture decision record (ADR) for Echo's memory and retrieval approach.
Covers the debate between fine-tuning, RAG, vector search, and hybrid
retrieval — with concrete recommendations based on Echo's specific needs:
>500 topics, dynamic context injection, and tool-use reliability.

---

## Context

Echo needs to:
1. **Inject relevant context** for 500+ topics/skills based on user query
2. **Reduce tool hallucination** (LLM calls wrong tool or malformed args)
3. **Scale context injection** without linear token growth per topic
4. **Manage three memory types** (episodic, semantic, procedural) across Go ↔ Agent

---

## The Landscape — Current Research (2024-2025)

### Fine-tuning for Tool Use

```
Strengths:
  - Teaches LLM the EXACT format for each tool call
  - Reduces hallucination rate by 40-60% (multiple papers)
  - No retrieval latency — behavior is baked into weights
  - Works offline, no dependency on retrieval pipeline

Weaknesses:
  - Static after training — can't add new tools without re-fine-tuning
  - Can't inject factual/dynamic knowledge (only behavior)
  - Costly to produce training data and re-fine-tune
  - Risk of catastrophic forgetting for general capabilities
```

### RAG / Vector Search

```
Strengths:
  - Dynamic — new topics added without model changes
  - Good for factual knowledge retrieval
  - Explainable (can show what was retrieved)
  - Scales to millions of documents

Weaknesses:
  - Retrieval latency (50-500ms)
  - Precision issues (irrelevant context hurts quality more than no context)
  - "Lost in the Middle" — model ignores context in the middle of prompt
  - Embedding quality varies significantly by domain
  - Pure vector search has cold-start problem (no documents → no results)
```

### Key Papers Referenced

| Paper | Year | Finding |
|-------|------|---------|
| "RAG vs Fine-tuning" (Microsoft) | 2024 | Fine-tuning for behavior/format, RAG for knowledge — complementary |
| "Lost in the Middle" (Liu et al.) | 2023 | Models use context at start/end of prompt; middle is often ignored |
| "When Not to Use RAG" | 2024 | For high-precision tool use, fine-tuning > RAG. RAG better for knowledge. |
| "Bingest: Structured Retrieval > Pure Vector" | 2025 | Hybrid search (BM25 + dense + filters) outperforms pure vector by 15-30% |
| "Tool-Augmented LLMs" (multiple) | 2024 | Fine-tuning tool format reduces hallucination. RAG for tool documentation. |

---

## Decision — Complementary Strategy

**Verdict: Both are needed. They solve different problems.**

| Problem | Solution | Why |
|---------|----------|-----|
| Tool hallucination | **Fine-tuning** (LLM provider) | Behavioral: format, argument patterns |
| Dynamic context injection | **Hybrid retrieval** (BM25 + pgvector) | Knowledge-based: per-query retrieval |
| Tool behavior docs | **Procedural memory** (existing) | Already in PostgreSQL, use as retrieval source |
| Session continuity | **Episodic memory** (Redis, existing) | Already live, improve recall query |
| Tool selection per query | **Classifier → Resolver** (see context-resolver-pattern.md in `execution/`) | Structured pipeline, no ML dependency |

**For Echo specifically:**
  - Fine-tuning addresses the **tool hallucination** problem
  - Hybrid retrieval addresses the **context injection** problem (>500 topics)
  - They are orthogonal — do both, in order of practical impact

---

## Architecture — Hybrid Retrieval for Echo

### Existing Memory Infrastructure

```
Go Backend (PostgreSQL + Redis)                    Agent (Hono)
┌────────────────────────────────────┐             ┌──────────────────┐
│                                    │             │                  │
│  memory_semantic (PostgreSQL)      │◄──Service──│  MemoryPlugin    │
│  - content, embedding, metadata    │    JWT      │  → calls via     │
│  - pgvector HNSW index (planned)   │             │    HTTP          │
│                                    │             │                  │
│  memory_procedural (PostgreSQL)    │             │  ToolRegistry    │
│  - id, name, content, metadata     │             │  → tool defs     │
│                                    │             │                  │
│  memory:episodic (Redis)           │             │  Classifier      │
│  - session_id → list               │             │  → topic detect  │
│  - 24h TTL                         │             │                  │
└────────────────────────────────────┘             └──────────────────┘
```

### Hybrid Search Pipeline

```
User Query
     │
     ├──→ BM25 (keyword via PostgreSQL tsvector)
     │     - Exact term matching
     │     - Stemming (english)
     │     - Stopword removal
     │     - Score: TF-IDF-based
     │
     ├──→ Dense (pgvector cosine similarity)
     │     - Embedding model: sentence-transformers (384d)
     │     - HNSW index for ANN search
     │     - Only if EmbeddingService available
     │
     ├──→ Structured Filters
     │     - tier: free/pro (from user context)
     │     - domain: infrastructure/devops/dev
     │     - language: id/en
     │
     └──→ RRF Fusion
           - score = Σ 1/(k + rank_i) where k=60
           - Merges BM25 + Dense rankings
           - Boosts documents that rank high in BOTH
           - Falls back to BM25-only if dense unavailable
```

### RRF Fusion Formula

```
score(d) = Σ  1 / (k + rank_i(d))
           i

Where:
  i = each retrieval method (BM25, Dense)
  rank_i(d) = rank position of document d in method i
  k = 60 (standard constant, prevents high rank domination)
```

---

## Gradual Implementation Plan

### Phase 0 — Today's Reality

```
Retrieval:
  - ToolRetriever: naive keyword scoring (0.6/0.3/0.1 weights)
  - No topic classifier
  - No hybrid search
  - Semantic memory: insertion works, query uses ILIKE (not vector)
  - Procedural memory: insertion works, get by id/name
  - Episodic memory: Redis LPUSH/LRANGE (working)

Tool Reliability:
  - No circuit breaker
  - No bounded retry
  - No strategy degradation
  - Error handling: catch → Observation → push to history
```

### Phase 1 — Immediate (zero new dependencies)

```
1. Circuit breaker + degradation (most urgent — reduces cost immediately)
   → Earlier docs: execution/circuit-breaker-pattern.md

2. TF-IDF classifier for intent detection
   → Earlier docs: execution/context-resolver-pattern.md (Phase 1)

3. Topic template registry (file-based)
   → Replace ToolRetriever keyword scoring
```

### Phase 2 — Structured Retrieval

```
4. BM25 via PostgreSQL tsvector
   → memory_semantic: add tsvector column + GIN index
   → memory_procedural: add tsvector column + GIN index
   → RRF with structured filters (tier, domain)

5. Topic registry → PostgreSQL table
   → topic_templates (id, aliases, domain, tier, keywords, prompts, tools)

6. Classifier: add stopword removal + bigram matching
```

### Phase 3 — Vector / Hybrid

```
7. pgvector HNSW index on memory_semantic.embedding
   → CREATE INDEX ON memory_semantic USING hnsw (embedding vector_l2_ops)

8. Embedding service for Agent
   → Worker thread or external endpoint
   → Models: sentence-transformers/all-MiniLM-L6-v2 (384d)

9. Full hybrid: BM25 + pgvector + RRF + structured filters
   → Gradual rollout — feature flag ENABLE_HYBRID_SEARCH

10. Fallback chain:
    Hybrid → BM25-only → keyword → fallback web_search
```

### Phase 4 — Fine-tuning (Optional)

```
11. Collect tool call traces from production
    → Identify hallucination patterns

12. Create fine-tuning dataset
    → Format: corrected tool calls for mis-called queries
    → Size: 500-2000 examples typically sufficient

13. Fine-tune model (provider-specific)
    → Requires provider support for fine-tuning
    → Measure hallucination rate before/after
```

---

## Decision Rules

### When to retrieve vs when to fine-tune

```
IF problem is "model calls wrong tool name/format"
  → Fine-tune

IF problem is "model lacks information to answer"
  → Hybrid retrieval

IF problem is "model has too many tools and picks wrong one"
  → Classifier → reduce tool surface area (context-resolver-pattern.md in `execution/`)
  → THEN fine-tune if still problematic

IF problem is "model ignores injected context"
  → Check prompt position (inject earlier, not in middle)
  → Shorten context (quality > quantity)
  → IF still problematic → fine-tune to pay attention to context
```

### When NOT to use vector search

```
- Cold start: <100 documents with embeddings
- Query is always keywords/code (not semantic)
- Latency budget <50ms (embedding + search takes 100-500ms)
- Domain mismatch (off-the-shelf embedding model doesn't understand domain)
  → Solution: domain-specific embedding model or BM25-only
```

### When to fall back

```
Layer       | Condition                        | Fallback
------------|----------------------------------|--------------------------
Classifier  | confidence < 0.3                 | "general" topic → no injection
BM25        | no results                       | Keyword substring matching (current ToolRetriever)
pgvector    | EmbeddingService unavailable     | BM25-only
Hybrid      | Both unavailable                 | web_search fallback
Fine-tuning | Provider doesn't support FT      | Prompt engineering + tool descriptions
```

---

## Context Position Strategy (Prompt Layout)

Retrieved context (knowledge fragments) must be positioned at the **absolute
tail** of the prompt — inside BLOCK 5 (Volatile Dynamic Tail). This placement
preserves the KV cache integrity of BLOCK 1-4 (System + Tools + Topics + History).

```
Prompt Layout:

  BLOCK 1: Global System Instructions          ← Static, always cache hit
  BLOCK 2: Tool Definitions (sorted)           ← Semi-static, cache hit per combo
  BLOCK 3: Topic Additions                     ← Semi-static, cache hit per topic
  BLOCK 4: Accumulated Chat History            ← Append-only, incremental cache hit
  ──────────────────────────────────────────
  BLOCK 5: Volatile Dynamic Tail               ← Always fresh (known miss)
    ├── <context>Knowledge Fragments</context>
    ├── <objective>Session Objective</objective>
    └── Latest User Prompt
```

**Rules:**
  - Knowledge fragments MUST NOT be inserted between BLOCK 4 and the user query.
    They belong inside the same HumanMessage as the query, at the tail.
  - If `RAG_REFRESH: 'first'` (default), knowledge is fetched only on turn 1.
    Subsequent turns reuse the same topic context from BLOCK 3.
  - If `RAG_REFRESH: 'every_turn'`, each turn appends fresh knowledge to BLOCK 5,
    accepting the cache miss cost per turn.

See `../application/features/execution/context-resolver-pattern.md` for detailed injection code and
`../../shared/architecture/headless-haas.md` for the full 5-block KV cache diagram.

---

## History Pruning Trap

When the chat session exceeds the context window, pruning or summarization
is required. A naive FIFO shift (removing `messages[1]`) **shifts every
subsequent token**, destroying the KV cache for the entire history.

**Solution — Hard Consolidation (Delegated to Agent):**

1. Go detects budget overflow (`SUM(token_count) >= PRUNE_THRESHOLD`)
2. Go calls Agent via internal endpoint: `POST /internal/sessions/summarize`
3. Agent calls LLM → summarizes oldest N turns → returns summary string
4. Go stores summary in `sessions.context_summary` (BLOCK 3)
5. Go deletes oldest N turns from `messages` table
6. Next turn: Go loads updated `context_summary` → BLOCK 3 updated
7. Accept exactly **one** cache miss on BLOCK 3 update
8. BLOCK 4 (remaining history) remains **intact** — cache hit

**Why delegated to Agent:**
  - Go does NOT have an LLM
  - Agent is stateless and can call any LLM provider
  - Go orchestrates threshold detection + DB operations
  - Agent handles the intelligence (summarization)

This is a controlled miss: 1 miss vs N misses for all remaining turns.

For implementation details:
  - Hard Consolidation protocol: `../application/features/state-session/session-management.md` → Hard Consolidation
  - Agent summarization endpoint: `../application/features/state-session/session-management.md` → Consolidation Endpoint
  - Per-turn observation immutability: `../application/features/execution/context-resolver-pattern.md` →
    Edge Case: Tool Loop Observation Compression

---

## Monitoring & Evaluation

### Metrics to Track

```
Retrieval:
  - Recall@K: was the relevant topic in top-K results?
  - Precision@K: of top-K results, how many were useful?
  - Latency p50/p95: classifier → resolver → hybrid search

Tool Reliability:
  - Tool call success rate (per tool)
  - Consecutive failures before circuit open
  - Degradation events per session
  - Average retries per tool call

Cost:
  - Tokens saved by observation compression
  - Tokens saved by reducing failed call context
  - Retrieval cost vs token cost trade-off
```

### A/B Testing Plan

```
Control: current ToolRetriever (keyword scoring)
Variant: Phase 1 (TF-IDF + topic registry)

Measure:
  - Tool call success rate
  - Average iterations per mission
  - User satisfaction (thumbs up/down)
  - Context window utilization
```

---

## Source References

+------------------------------------------+------------------------------------------------------+
| Reference                                | Notes                                                |
+------------------------------------------+------------------------------------------------------+
| `docs/shared/architecture/headless-      | Existing HaaS architecture — bridge Go ↔ Agent      |
|   haas.md`                               |                                                      |
| `docs/shared/architecture/zero-tight-    | Interface-first design — retrieval is swappable      |
|   coupling.md`                           |                                                      |
| `docs/agent/application/features/        | Context resolver — replaces ToolRetriever            |
|                           |   execution/context-resolver-pattern.md` |                                                      |
| `docs/agent/application/features/        | Circuit breaker — reduces retry bloat                |
|                           |   execution/circuit-breaker-pattern.md`  |                                                      |
| `docs/agent/application/features/        | Go as session authority, session CRUD, commit policy |
|                           |   state-session/session-management.md`   |                                                      |
| `backend/internal/handler/               | Existing memory endpoints — PostgreSQL + Redis       |
|                           |   memory_handler.go`                     |                                                      |
| `backend/scripts/init-pgvector.sql`      | pgvector extension — HNSW index planned              |
+------------------------------------------+------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
