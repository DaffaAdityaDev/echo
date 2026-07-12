===============================================================================
  Context Resolver - Topic-Aware Context Injection for >500 Topics
===============================================================================
  Module    : Context Resolver Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Description

> [!WARNING]
> **Status: PLANNED (Not Yet Implemented)**  
> The Context Resolver architecture and components described here (`agent/src/core/agent/classifier/`, `agent/src/core/agent/topics/`, and `resolver.ts`) are planned for a future implementation phase. The current codebase still uses the naive keyword-based `ToolRetriever` (`src/core/agent/tools/retriever.ts`).

Three-layer context resolution system that takes a user query and injects
only the relevant system instructions, tools, and knowledge fragments into
the agent's context window. Designed to scale from 50 to 500+ topics without
bloating context.

Replaces the current `ToolRetriever` (`retriever.ts`) — which uses naive
keyword overlap scoring — with a structured pipeline: Classifier → Resolver
→ Optional Hybrid Retrieval.

---

## Problem

Current `ToolRetriever.getRelevantTools(state.objective, allTools)`:
  - Pure substring matching (lowercased includes check)
  - Weights: keyword 0.6, description 0.3, name 0.1
  - No stopword removal, no TF-IDF weighting
  - No topic/skill awareness — treats all tools equally
  - Fallback: always returns `[web_search]` if nothing matches

For >500 topics, keyword matching alone produces:
  - Low precision: "deploy k8s" matches "web_search" because "web" is in prompt
  - Low recall: "kubernetes deployment guide" doesn't match "k8s" keyword
  - No structured filtering: can't distinguish "deploy" (software) vs "deploy" (military)

---

## Architecture — Three-Layer Retrieval

```
  User Query
       │
       ▼
┌──────────────────┐
│  Layer 1:        │  Intent Classifier (<50ms)
│  Classifier      │  Output: { topics: string[], confidence: float }
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Layer 2:        │  Context Resolver (synchronous)
│  Resolver        │  Input: topics[]
│                  │  Output: {
│                  │    systemPromptAdditions: string[],
│                  │    preferredTools: ToolDefinition[],
│                  │    knowledgeFragments: string[],
│                  │    proceduralMemory: object[]
│                  │  }
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Layer 3:        │  Hybrid Retrieval (optional, for >500 topics)
│  Hybrid Search   │  BM25 + pgvector + structured filters
│                  │  RRF fusion
└──────────────────┘
```

---

## Layer 1: Intent Classifier

### Phase 1 — TF-IDF + Bigram (zero dependency)

```
Implementation:
  - Build TF-IDF vectorizer offline from topic definitions
  - On query: vectorize query, compute cosine similarity
  - Return top-3 topics with confidence score
  - Bigram matching for compound terms: "machine learning", "kubernetes"

TopicRegistry schema:
  {
    id: string,                    // "kubernetes"
    aliases: string[],             // ["k8s", "kube", "kubernetes cluster"]
    domain: string,                // "infrastructure" | "development" | etc.
    tier: 'free' | 'pro',
    keywords: string[],            // for TF-IDF corpus
    description: string,
  }

Fallback:
  - If max confidence < 0.3 → classify as "general"
  - "general" returns no topic-specific context (default behavior)
```

### Phase 2 — Lightweight ML Classifier (optional)

```
If TF-IDF precision is insufficient:
  - ONNX runtime with distilled BERT classifier
  - Runs in worker_thread (non-blocking)
  - 50-100ms inference time
  - Trained on synthetic queries + real usage data
```

---

## Layer 2: Context Resolver

### Topic Template Registry

```
Storage: agent/src/core/agent/topics/registry.ts (Phase 1)
         → PostgreSQL topic_templates table (Phase 2)

topicTemplates: Map<string, TopicTemplate>

TopicTemplate {
  id: string,
  systemPromptAdditions: string[],    // injected after main system prompt
  preferredTools: string[],            // tool names to resolve
  knowledgeQueries: string[],          // for semantic retrieval
  proceduralKeys: string[],            // procedural memory keys
  compression: {                       // per-topic override
    enabled: boolean,
    ratio: number,
  },
  pacing: {
    enabled: boolean,
    threshold: number,
  },
}
```

### Resolution Flow

```
resolve(topics: string[], userQuery: string) → ResolvedContext {

  // 1. Collect template data
  additions: string[] = []
  toolNames: Set<string> = []
  knowledgeQueries: string[] = []
  proceduralKeys: string[] = []

  for topic of topics:
    template = topicTemplates.get(topic)
    if template:
      additions.push(...template.systemPromptAdditions)
      toolNames.add(...template.preferredTools)
      knowledgeQueries.push(...template.knowledgeQueries)
      proceduralKeys.push(...template.proceduralKeys)

  // 2. Resolve tools
  tools = toolRegistry.resolveTools([...toolNames])

  // 3. Optionally fetch procedural knowledge
  proceduralMemory = await proceduralStore.getBatch(proceduralKeys)

  // 4. Optionally fetch semantic knowledge (Layer 3)
  knowledgeFragments = await hybridSearch(knowledgeQueries, userQuery)

  return {
    systemPromptAdditions: additions,
    tools,
    knowledgeFragments,
    proceduralMemory,
  }
}
```

### Context Budget

Each topic template must declare a token budget:

```
Budget constraints:
  - systemPromptAdditions: max 500 tokens per topic
  - Tool definitions: max 2000 tokens total
  - knowledgeFragments: max 1500 tokens total
  - Hard limit: 4000 tokens for all injected context

Measured at injection time. If budget exceeded, prioritize by:
  1. confidence score (from classifier)
  2. template priority field
  3. most recently used
```

---

## Layer 3: Hybrid Retrieval (for >500 topics)

### Search Pipeline

```
                    User Query
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
     ┌─────────────────┐  ┌─────────────────┐
     │   BM25 (sparse)  │  │  pgvector (dense)│
     │   keyword match  │  │  cosine sim.     │
     │   TF-IDF scoring │  │  embedding model │
     └────────┬─────────┘  └────────┬─────────┘
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────┐
              │  RRF Fusion     │
              │  score = Σ 1/(k+rank) │
              └────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Structured     │
              │  Filters        │
              │  tier, domain   │
              └────────┬─────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Top-K results  │
              └─────────────────┘
```

### Implementation Notes

```
BM25:
  - Built-in PostgreSQL tsvector (no extra dependency)
  - OR use tantivy/FTS library for BM25 scoring
  - English stemmer, stopword removal

pgvector:
  - Already in schema: memory_semantic table has embedding column
  - Uses HNSW index for approximate nearest neighbor
  - Embedding model: sentence-transformers (all-MiniLM-L6-v2)
  - Dimension: 384

RRF (Reciprocal Rank Fusion):
  - K constant: 60 (standard from literature)
  - Merges BM25 and vector rankings
  - Boosts results that rank highly in both

Structured Filters:
  - tier: free/pro (from topic registry)
  - domain: infrastructure/development/devops/etc.
  - language: id/en (for code-specific queries)
```

---

## Integration with Harness

### Architecture Note: History Source of Truth

BLOCK 4 (Accumulated Chat History) is **loaded by Go from PostgreSQL session
store** before being forwarded to the Agent. The Agent receives a pre-built
`state.messages[]` array that already contains:

```
messages[0]: anchor (system + topic additions)   ← BLOCK 1-3 combined
messages[1..N]: previous turns                    ← BLOCK 4 (from session DB)
```

The Agent does NOT reconstruct history from frontend data. Go is the sole
session authority (see `session-management.md` in `state-session/`).

The Agent's responsibility is:
  1. Classify query → inject topic additions into anchor (BLOCK 3)
  2. Append knowledge fragments + current query as the final message (BLOCK 5)
  3. Run ReAct loop in-memory, commit results via `turn_complete` packet to Go

### Modified Tool Resolution (in NlahHarness)

```
Current (harness.ts:122-131):
  if (this.explicitTools !== undefined) → use as-is
  else → toolRetriever.getRelevantTools(state.objective)

Proposed:
  // state.messages is pre-loaded by Go from session store.
  // messages[0] = anchor, messages[1..N-1] = BLOCK 4 history.
  // This code runs before the main harness loop.

  if (this.explicitTools !== undefined) → use as-is (unchanged)
  else:
    // 1. Classify query → topics
    topics = classifier.classify(state.objective)

    // 2. Resolve context
    context = contextResolver.resolve(topics, state.objective)

    // 3. Inject system prompt additions into BLOCK 3
    //    Anchor is messages[0], already loaded by Go.
    for addition of context.systemPromptAdditions:
      state.messages[0].content += '\n\n' + addition

    // 4. Set tools
    tools = context.tools

    // 5. Append knowledge + query as BLOCK 5 (single turn at end of messages)
    //    BLOCK 4 (messages[1..N]) remains untouched — cacheable prefix.
    if context.knowledgeFragments.length > 0:
      turnContent = '<context>\n' +
        context.knowledgeFragments.join('\n\n') +
        '\n</context>\n\n' +
        state.objective

      state.messages.push(new HumanMessage({ content: turnContent }))
    else:
      state.messages.push(new HumanMessage({ content: state.objective }))
```

### Context Position Strategy

All injected context respects the **prefix-caching** optimization:

```
Prompt Layout (5-Block Architecture):

  ┌───────────────────────────────────────────────────┐
  │ BLOCK 1: GLOBAL SYSTEM INSTRUCTIONS               │  ← Static (100% Cache Hit)
  │   "You are Echo, an autonomous executor..."        │
  │   - Core persona, ReAct rules, SSE contract       │
  │                                                     │
  │   KV CACHE: ✓ Reused across ALL users/sessions     │
  └───────────────────────────────────────────────────┘
                          │
                          ▼
  ┌───────────────────────────────────────────────────┐
  │ BLOCK 2: BOUNDED TOOL DEFINITIONS (Sorted)        │  ← Semi-static (Cache Hit)
  │   <available_tools>                                 │     per tool combo
  │   - code_execute: { name, desc, params }           │
  │   - web_search:   { name, desc, params }           │
  │   </available_tools>                                │
  │                                                     │
  │   KV CACHE: ✓ Same features[] = identical string   │
  │             ✗ Different tool combo                 │
  └───────────────────────────────────────────────────┘
                          │
                          ▼
  ┌───────────────────────────────────────────────────┐
  │ BLOCK 3: TOPIC ADDITIONS                           │  ← Semi-static (Cache Hit)
  │   [kubernetes-specific system instructions]        │     per topic
  │   [hard consolidation summary if pruned]           │
  │                                                     │
  │   KV CACHE: ✓ Same topic across turns              │
  │             ✗ Topic switches between requests      │
  └───────────────────────────────────────────────────┘
                          │
                          ▼
  ┌───────────────────────────────────────────────────┐
  │ BLOCK 4: ACCUMULATED CHAT HISTORY                 │  ← Append-Only Dynamic
  │   messages[1..N] where N = previous turns          │     (Incremental Cache Hit)
  │                                                     │
  │   messages[1]: anchor (system)                      │
  │   messages[2]: turn 1 (Human + Assistant)           │
  │   messages[3]: turn 2 (Human + Assistant)           │
  │   ...                                               │
  │   messages[N]: turn N-1 (Human + Assistant)         │
  │                                                     │
  │   KV CACHE: ✓ Previous turns stay cached            │
  │             ✓ Only new appended turn misses         │
  │             ✗ History pruning = full miss (see      │
  │               History Pruning Trap below)           │
  └───────────────────────────────────────────────────┘
                          │
                          ▼
  ┌───────────────────────────────────────────────────┐
  │ BLOCK 5: VOLATILE DYNAMIC TAIL                    │  ← Always Fresh
  │   ├── Current Knowledge Fragments (RAG this turn)  │     (Known Cache Miss)
  │   ├── Session Objective                             │
  │   └── Latest User Prompt                            │
  │                                                     │
  │   KV CACHE: ✗ Always computed fresh                │
  │             ✗ Does NOT invalidate BLOCK 1-4 prefix │
  └───────────────────────────────────────────────────┘
```

### KV Cache Behavior by Turn

```
Turn 1:
  → BLOCK 1-3: cold (first request) or warm (earlier session)
  → BLOCK 4: empty or anchor only
  → BLOCK 5: fresh — miss
  Total: 1 miss (BLOCK 5)

Turn 2 (same topic, same tool combo):
  → BLOCK 1-3: HIT ✓ (identical prefix)
  → BLOCK 4: HIT for messages[1..N] (previous turn cached)
  → BLOCK 4: only new appended turn is computed
  → BLOCK 5: fresh — miss
  Total: incremental — only the new turn history + BLOCK 5

Turn 3 (topic switches):
  → BLOCK 1: HIT ✓ (always static)
  → BLOCK 2: HIT or MISS depending on tool combo change
  → BLOCK 3: MISS (topic changes)
  → BLOCK 4: HIT for messages[1..N] (history still cached)
  → BLOCK 5: fresh — miss
  Total: BLOCK 3 miss is the cost of topic switch — acceptable
```

### Edge Case: History Pruning Trap

**Problem:** When chat history exceeds the context window, best practice is to
prune or summarize old turns. A naive FIFO approach (`shift messages[1]` to
remove oldest turn) **shifts every subsequent token in the prefix**, causing
a 100% KV cache miss on the entire history.

```
Naive FIFO Pruning (DESTROYS cache):
  Before (cached): [anchor][turn1][turn2][turn3]
  Remove turn1:    [anchor]     [turn2][turn3] ← shift → full cache miss
```

**Who triggers pruning: Go (Session Authority).**

The Agent does NOT prune history. Go detects token threshold overflow
(`SUM(token_count) >= PRUNE_THRESHOLD`) and delegates summarization to
Agent via an internal endpoint. See `session-management.md` in `state-session/` → Hard Consolidation.

**Solution — Hard Consolidation:**

Instead of shifting, consolidate the oldest turns into a single static
summary inserted into BLOCK 3 (Topic Additions / Context Consolidation):

```
Hard Consolidation (PRESERVES cache):
  Before:  [anchor][turn1][turn2][turn3][turn4][turn5]
                                                      ↑ context window full

  After:   [anchor + consolidation summary][turn4][turn5]
           └────── BLOCK 3 updated ──────┘

  1. Go detects threshold → calls Agent POST /internal/sessions/summarize
  2. Agent calls LLM → returns summary string
  3. Go stores summary in sessions.context_summary (BLOCK 3)
  4. Go deletes turn1-3 from messages table
  5. Next turn: Go loads updated context_summary → BLOCK 3 new prefix
  6. Accept ONE cache miss on BLOCK 3 (consolidation)
  7. BLOCK 4 (turn4-5) stays INTACT — cache HIT for remaining history
```

This triggers exactly **one** controlled cache miss (BLOCK 3 update) instead
of N misses across all remaining turns.

**Important:** The Agent-side code shown above (Modify Tool Resolution) only
runs on fresh turns. Pruning is transparent to the Agent's main loop — it
receives pre-consolidated messages from Go.

### Edge Case: Tool Loop Observation Compression

During active tool execution within a turn, the harness produces:
```
AIMessage { tool_calls: [toolCall] }    ← before tool execution
ToolMessage { observation }              ← after tool execution result
```

**IMPORTANT:** Observation compression (circuit-breaker-pattern.md) must
be applied **before** these messages are committed to the history array.
Once a turn completes and messages enter BLOCK 4 (Accumulated History),
they are **immutable** — never mutate historical messages.

```
Turn N active (tool loop in progress):
  AIMessage(toolCall) + ToolMessage(raw output) ← compressed in-memory
  → compression applied here
  → compressed messages committed to history

Turn N+1:
  messages[N] = compressed AIMessage + ToolMessage ← STATIC, do not mutate
```

This is already handled by the circuit breaker's `compressObservation()`
being called at the execution boundary, before `state.messages.push()`.`

---

## Gradual Implementation Phases

### Phase 1 (Immediate, zero dependencies)

```
- TF-IDF classifier (pure JS/TS, no external libs)
- Topic template registry (file-based JSON or TypeScript map)
- Context resolver synchronous
- No knowledge retrieval yet
- Tools resolved via template → toolRegistry.resolveTools()
```

### Phase 2 (PostgreSQL-backed)

```
- Topic templates moved to PostgreSQL table
- Procedural memory integration (existing, unused endpoint)
- BM25 via PostgreSQL tsvector
- Structured filters
```

### Phase 3 (Vector/hybrid)

```
- pgvector HNSW index creation
- Embedding service (worker or external API)
- RRF fusion of BM25 + vector results
- Fallback to keyword-only if embedding unavailable
```

---

## Configuration

```
CONTEXT_RESOLVER = {
  ENABLED: true,
  CLASSIFIER: 'tfidf',               // 'tfidf' | 'ml' | 'off'
  HYBRID_SEARCH: false,              // Phase 3 toggle
  RAG_REFRESH: 'first',              // 'first' (default) | 'every_turn'
  MAX_PROMPT_ADDITIONS: 500,         // tokens
  MAX_KNOWLEDGE_TOKENS: 1500,
  MAX_TOOL_TOKENS: 2000,
  HARD_CONTEXT_BUDGET: 4000,
  CLASSIFIER_THRESHOLD: 0.3,         // min confidence for topic match
}
```

---

## Entry Points & Exports

+-----------------------------+----------------------------------+--------------------------------------------+
| Export                      | Source                           | Type                                       |
+-----------------------------+----------------------------------+--------------------------------------------+
| `Classifier`                | `classifier/index.ts`            | Interface + TF-IDF / ML impl              |
| `TopicRegistry`             | `topics/registry.ts`             | Class (template management)                |
| `ContextResolver`           | `resolver.ts`                    | Class (orchestration)                      |
| `HybridSearch`              | `search/hybrid.ts`               | BM25 + pgvector + RRF (Phase 3)           |
| `CONTEXT_RESOLVER_CONFIG`   | `config/constants.ts`            | Configuration constants                    |
+-----------------------------+----------------------------------+--------------------------------------------+

---

## Source References

+---------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                       | File                                     | Key Lines                                             |
+---------------------------+------------------------------------------+-------------------------------------------------------+
| ToolRetriever (current)   | `services/retriever.ts`                  | Naive keyword scoring — to be replaced                |
| RETRIEVER_CONFIG          | `services/retriever.constants.ts`        | Current weights: 0.6/0.3/0.1                          |
| Tool resolution in harness| `harness/nlah/harness.ts:122-131`        | Where retriever is called                             |
| Prefix-caching layout     | `docs/shared/architecture/headless-      | KV cache optimization strategy                       |
|                           |   haas.md`                              |                                                       |
| Session management        | `docs/agent/application/features/        | Go as session authority, BLOCK 4 loading, pruning     |
|                           |   state-session/session-management.md`  |                                                       |
| Semantic memory table     | `backend/internal/handler/               | PostgreSQL + pgvector (embedding column exists)       |
|                           |   memory_handler.go`                     |                                                       |
| Mission schema (Zod)      | `app/api/missions/mission.schema.ts`     | Features/skills in mission payload                    |
+---------------------------+------------------------------------------+-------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
