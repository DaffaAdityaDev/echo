===============================================================================
  Prompt Cache Optimization - KV Cache & Prompt Caching Strategy
===============================================================================
  Module    : Prompt Optimization
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
===============================================================================

## Description

Every LLM call re-processes the entire prompt from scratch unless parts of it
are cached. KV cache (for self-attention) and prompt caching (Anthropic/OpenAI
server-side) share one rule: **stable prefixes hit cache, dynamic tails miss**.

This doc defines the layout that maximizes cache hit ratio across all turns of
a mission and across missions sharing the same system prompt prefix.

---

## Prompt Layout (Cache Zones)

```
┌────────────────────────────────────────────────────────────────┐
│  ZONE 1: SYSTEM PROMPT (FIXED)                                 │
│  ─────────────────────────────                                 │
│  - Strategy template (NLAH, ReAct, etc.)                       │
│  - Skill behavioral prompts (if any)                           │
│  - NEVER changes mid-mission                                   │
│  - Anthropic: sent as top-level `system` parameter             │
│  - OpenAI: messages[0] with role="system"                      │
│  ⇒ 100% cache hit after first turn                             │
├────────────────────────────────────────────────────────────────┤
│  ZONE 2: STRUCTURED TOOLS (FIXED)                              │
│  ───────────────────────────────                                │
│  - Array of tool definitions (name, schema, description)       │
│  - NEVER cleared mid-mission (pacing uses flag, not tools=[])  │
│  - Anthropic: tools[] in API + cache_control on ALL tools      │
│  - OpenAI: tools[] in API (auto prefix cached by OpenAI)       │
│  ⇒ 100% cache hit after first turn                             │
├────────────────────────────────────────────────────────────────┤
│  ZONE 3: ANCHOR + HISTORY (SEMI-FIXED)                         │
│  ───────────────────────────────────────                       │
│  - Anchor message (system-level instruction)                   │
│  - Previous conversation history (from user)                   │
│  - Stable during mission, but varies between missions          │
│  ⇒ Partial cache hit (shared prefix across turns)              │
├────────────────────────────────────────────────────────────────┤
│  ZONE 4: LATEST TURN (DYNAMIC)                                 │
│  ───────────────────────────                                    │
│  - Current user message / assistant response / tool result     │
│  - GROWS at the end every turn                                 │
│  - Compaction may compress middle turns, but keeps LAST turns  │
│  ⇒ Always misses cache (unavoidable — this is the new content) │
└────────────────────────────────────────────────────────────────┘
```

Zones 1 + 2 are the **fixed prefix** — they are identical across every LLM
call within a mission. The provider's KV cache (or server-side prompt cache)
reuses these tokens at near-zero cost after the first turn.

---

## Golden Rules

### 1. System Prompt NEVER changes mid-mission

Built once before the harness loop in `harness.ts:130`:

```typescript
let systemPrompt = this.strategy.buildSystemPrompt(state, tools);
if (this.skills && this.skills.length > 0) {
    systemPrompt += '\n\n' + skillPrompts;
}
```

This runs ONCE. Never modified inside the `while` loop.

### 2. Tools parameter NEVER changes mid-mission

The `tools` array passed to `provider.stream()` must be **stable**. The only
exception is Anthropic-specific `cache_control` metadata, which is orthogonal.

**Tool selection at mission start:**

- If `features[]` is explicitly provided (non-empty) → `resolveTools()` loads those tools
- If `features[]` is provided as empty `[]` → `resolveTools([])` returns `[]`,
  harness receives empty tool list — agent has NO tools
- If `features` is `undefined` → `resolveTools()` is NOT called. If skills
  exist, skills' `preferredTools` are resolved. Otherwise harness falls back
  to `ToolRetriever` which selects tools by keyword match against the objective
  — called once before the loop, result is stable

**Before (BAD — busts tool cache):**
```typescript
// pacing clears tools entirely
tools = [];
toolMap = new Map();
```

**After (GOOD — flag instead):**
```typescript
this.pacingForced = true;
toolMap = new Map();
// tools array stays intact → KV cache preserved
```

### 3. Messages always APPEND, never PREPEND or INSERT

New turns are always pushed to the end:

```typescript
state.messages.push(new HumanMessage(...));
state.messages.push(new AIMessage({...}));
state.messages.push(new ToolMessage({...}));
```

This ensures the existing prefix (Zones 1-3) stays stable.

### 4. Compaction preserves prefix, compresses middle

Compaction (triggered at 80% token ratio) runs:
```
[Anchor, summaryMsg, ...droppedLastTurns]
```

- **Anchor** stays → prefix unchanged
- **Summary** replaces middle turns → new tokens in middle (cache miss on those)
- **Last turns** preserved → suffix is lost but unavoidable

---

## Provider-Specific Strategies

### Anthropic (Claude)

| Feature | Implementation | File |
|---------|---------------|------|
| System `cache_control` | System content as `[{type:"text", text, cache_control:{type:"ephemeral"}}]` | `providers/anthropic/index.ts:34-40` |
| Tools `cache_control` | Every tool gets `cache_control:{type:"ephemeral"}` | `providers/anthropic/index.ts:42-48` |

Claude supports `cache_control` on both the `system` parameter and individual
tools. This ensures the entire fixed prefix (Zones 1 + 2) is cached server-side.

**How LangChain passes it through:**

```typescript
new SystemMessage({ content: [{ type: "text", text: "...", cache_control: { type: "ephemeral" } }] })
```

LangChain's `_convertMessagesToAnthropicPayload()` extracts `messages[0].content`
as the `system` parameter. If content is an array, it sends the array as-is,
preserving `cache_control` blocks.

### OpenAI (GPT-4o, GPT-4o-mini)

| Feature | Implementation |
|---------|---------------|
| Prompt Caching | **Automatic** — no special headers needed |
| Cached content | System message at messages[0], tools[] parameter |

OpenAI's Prompt Caching v2 (Nov 2024+) automatically caches the beginning of
the messages array. The longer the shared prefix, the more benefit.

**Optimization:** Keep the system message first and the tools parameter stable.
No special `cache_control` annotations needed — OpenAI handles it transparently.

### OpenCodeGo

Same API as OpenAI (uses `openai` SDK directly). Prompt caching behavior
matches OpenAI — automatic prefix caching on system message + tools.

### LM Studio

Local inference — no server-side prompt caching. KV cache is entirely
determined by the local inference engine. The prompt structure still matters
for GPU KV cache reuse across turns.

---

## Anthropic cache_control Placement

```typescript
// System: cache the entire instruction block
const systemContent = [{
    type: "text" as const,
    text: systemParts.join('\n\n'),
    cache_control: { type: "ephemeral" as const }
}];
new SystemMessage({ content: systemContent })

// Tools: cache every tool definition (stable set)
const lcTools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema,
    cache_control: { type: "ephemeral" as const }
}));
```

**Why ALL tools (not just the last one):**

Anthropic charges per cache write (`cache_creation`) but reads (`cache_read`)
are ~90% cheaper. Writing more blocks upfront (all tools + system) means:
- One-time cache creation cost at the first turn
- Cache reads on every subsequent turn — 90% cheaper than re-processing

Since the tool set never changes mid-mission, marking ALL tools for caching is
strictly better than marking only the last one.

### Cache Budget (Anthropic)

Anthropic limits how many blocks can have `cache_control` at once.
For Claude 3.5 Sonnet / Claude 4: up to 4 blocks can be cached.

| Block | Size | Cache |
|-------|------|-------|
| System prompt | ~500 tokens | `cache_control` |
| Tools (combined as 1-2 blocks) | ~2000 tokens | `cache_control` |
| Anchor + History | ~variable | No cache_control |
| Latest messages | ~variable | No cache_control |

Typically 2-3 cache blocks cover the entire fixed prefix, well within
the 4-block limit.

---

## Example: Turn-by-Turn Cache Behavior

### Turn 1 (First call — cache miss)

```
LLM API Call:
  system:  "You are Echo..."         ← WRITE cache (cache_creation cost)
  tools:   [web_search, write_todos] ← WRITE cache
  messages: [anchor, user_msg]       ← no cache
```

### Turn 2 (Cache hit on prefix)

```
LLM API Call:
  system:  "You are Echo..."         ← READ cache (90% cheaper)
  tools:   [web_search, write_todos] ← READ cache
  messages: [anchor, user_msg,       ← prefix cached from before
             AIMessage, ToolResult]  ← new tail (miss, unavoidable)
```

### Turn N (Same prefix, longer tail)

```
LLM API Call:
  system:  "You are Echo..."         ← READ cache
  tools:   [web_search, write_todos] ← READ cache
  messages: [anchor, user_msg,       ← still cached
             AIMessage, TR,          ← cached from turn 2
             AIMessage2, TR2, ...]   ← grows here, only this misses
```

---

## Source References

+----------------------------+------------------------------------------+------------------------------------------+
| Ref                        | File                                      | Key Lines                                |
+----------------------------+------------------------------------------+------------------------------------------+
| System prompt construction | `harness/nlah/harness.ts`                 | `buildSystemPrompt()` once before loop   |
| Tool array passed to LLM   | `harness/nlah/harness.ts`                 | `provider.stream(msg, tools, sys)`       |
| Pacing (preserves tools)   | `harness/nlah/harness.ts`                 | `pacingForced` flag instead of tools=[]  |
| Anthropic cache_control    | `providers/anthropic/index.ts`            | System + all tools get ephemeral cache   |
| OpenAI prompt caching      | `providers/openai/index.ts`               | Auto — no special handling needed        |
| LangChain Anthropic conv   | `node_modules/@langchain/anthropic/...`   | `_convertMessagesToAnthropicPayload()`   |
+----------------------------+------------------------------------------+------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================