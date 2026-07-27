================================================================================
  AI-READY SYSTEM MATURITY MODEL
================================================================================
  Module    : AI-Ready Maturity Model
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-25
================================================================================

## Description

A generalized, pattern-agnostic maturity model for assessing AI readiness
across any business system. Decoupled from specific tools, skills, prompts,
or architectures — new patterns that emerge after the harness naturally
slot into the existing levels and dimensions.

Dual purpose:
  - **Internal** — Echo self-assessment (harness, infra, observability, code)
  - **External** — Client company assessment (their tools, APIs, data, security)

The model is designed to be transparent: users and clients see level
improvements, not pattern changes underneath. Like Cursor swapping models
under the hood, Echo swaps patterns without exposing the churn.

---

## The Five Levels

Each level describes the relationship between a system and an AI agent
operating on it. The definitions are abstract — they apply to any domain.

```
L1 ─── L2 ─── L3 ─── L4 ─── L5
Ad Hoc → Cataloged → Structured → Validated → Agentic
```

+-------+---------------------------+---------------------------------------------+
| Level | Name                      | Definition (pattern-agnostic)               |
+-------+---------------------------+---------------------------------------------+
| 1     | Ad Hoc                    | No formal contracts. Every output is a      |
|       |                           | one-off. AI has nothing reliable to anchor  |
|       |                           | to. Consistency depends on who built it.    |
|       |                           | Hallucination is the default.               |
+-------+---------------------------+---------------------------------------------+
| 2     | Cataloged                 | Things are listed somewhere, but code has   |
|       |                           | drifted from documentation. Naming is       |
|       |                           | inconsistent. AI can read the catalog but   |
|       |                           | cannot trust it — output is plausible but   |
|       |                           | often wrong.                                |
+-------+---------------------------+---------------------------------------------+
| 3     | Structured                | Real contracts exist (schemas, interfaces,  |
|       |                           | typed boundaries). Humans work efficiently. |
|       |                           | But rules still live in people's heads and  |
|       |                           | review comments. AI output is "mostly       |
|       |                           | right" — needs human cleanup.               |
+-------+---------------------------+---------------------------------------------+
| 4     | Validated                 | Rules are enforceable at build — they fail  |
|       |                           | CI, not review. Schema-driven everywhere.   |
|       |                           | AI produces usable output within explicit   |
|       |                           | guardrails. Drift is caught early. The most |
|       |                           | valuable jump.                              |
+-------+---------------------------+---------------------------------------------+
| 5     | Agentic                   | AI executes autonomously within             |
|       |                           | fully-specified contracts. Human review is  |
|       |                           | the exception, reserved for high-stakes     |
|       |                           | work. Feature velocity 5-10x. Governance    |
|       |                           | holds without a person in every loop.       |
+-------+---------------------------+---------------------------------------------+

---

## Assessment Dimensions

Every dimension defines a spectrum across the five levels. The definitions
are implementation-agnostic — they describe intent, not specific tooling.

+----------------+--------------------------------------------------------------+
| Dimension      | What It Measures                                            |
+----------------+--------------------------------------------------------------+
| Tools          | How callable units are defined, discovered, secured, and    |
|                | executed. Whether an agent can find, trust, and invoke them |
|                | without human intervention.                                 |
+----------------+--------------------------------------------------------------+
| Skills         | How behavioral patterns are captured, composed, and         |
|                | applied. Whether skills are prose, templates, schemas, or   |
|                | auto-discovered chains.                                     |
+----------------+--------------------------------------------------------------+
| Prompts        | How instructions to AI are authored, versioned, validated,  |
|                | and compiled. Whether prompts are hardcoded, templated,     |
|                | schema-driven, or dynamically constructed by the agent.     |
+----------------+--------------------------------------------------------------+
| API Security   | How external interfaces are protected — auth, rate          |
|                | limiting, input validation, injection prevention,           |
|                | policy enforcement. Whether security is manual, basic,      |
|                | schema-enforced, or policy-as-code.                         |
+----------------+--------------------------------------------------------------+
| Data Models    | How domain entities are defined, documented, validated,     |
|                | and evolved. Whether models are undocumented, prose-only,   |
|                | schema-driven, machine-validated, or self-describing.       |
+----------------+--------------------------------------------------------------+
| Observability  | How system behaviour is captured, structured, traced, and   |
|                | acted upon. Whether it is raw logs, structured output,      |
|                | traced spans, automated alerting, or self-healing.          |
+----------------+--------------------------------------------------------------+
| Documentation  | How knowledge is captured and consumed. Whether it is       |
|                | missing, prose-only, schema-driven, CI-enforced, or         |
|                | auto-generated from code.                                   |
+----------------+--------------------------------------------------------------+

### Dimension Spectrum (All Dimensions)

```
L1: Ad Hoc          — Nothing defined. Manual everything. No contracts.
L2: Cataloged       — Listed somewhere. Inconsistent. Drifted from truth.
L3: Structured      — Schema-defined. Typed boundaries. Human-efficient.
L4: Validated       — Enforceable at build. CI-gated. Machine-verifiable.
L5: Agentic         — Self-describing. Auto-discovered. Autonomous execution.
```

---

## Current Implementation Mappings

These show what each dimension looks like at Structured (L3) and Validated
(L4) using Echo's current patterns. **These mappings evolve** — when new
patterns emerge (new tool protocols, prompt architectures, security models),
this section gets updated. The abstract model above never changes.

### Tools

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Definition             | ToolDefinition schema (Zod)             | + Schema-enforced at invocation     |
| Discovery              | Lazy-loaded registry                    | + Contract-first, CI-validated      |
| Execution              | Bounded toolset per mission             | + Circuit breakers per tool         |
| Security               | Features[] tier-gated                   | + Input validated against schema    |
| Next pattern slot      | —                                       | MCP, gRPC, streaming tools          |
+------------------------+-----------------------------------------+-------------------------------------+

### Skills

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Definition             | Static system prompt + tool prefs       | + Schema-defined skill contracts    |
| Composition            | Manual selection                        | + Composable via config             |
| Discovery              | Listed in registry                      | + CI-validated composition rules    |
| Next pattern slot      | —                                       | Auto-discovered skill chains        |
+------------------------+-----------------------------------------+-------------------------------------+

### Prompts

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Architecture           | 5-block prefix-caching layout           | + Block validation at compile       |
| Versioning             | Template per strategy                   | + CI-versioned, diff-tracked        |
| Injection prevention   | Basic sanitization                      | + Structural scanning per prompt     |
| Next pattern slot      | —                                       | Dynamic compilation per context     |
+------------------------+-----------------------------------------+-------------------------------------+

### API Security

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Auth                   | Dual JWT (User + Service)               | + Short-lived, per-request tokens   |
| Rate limiting          | Planned (documented)                    | + Enforced at proxy                 |
| Injection prevention   | Schema validation                       | + Policy-as-code, zero-trust        |
| Next pattern slot      | —                                       | Real-time threat scanning           |
+------------------------+-----------------------------------------+-------------------------------------+

### Data Models

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Definition             | Go structs + Zod schemas                | + Schema enforced on every mutation |
| Documentation          | Domain docs (models-data-flow.md)       | + Schema-driven, machine-readable   |
| Evolution              | Manual migration                        | + CI-gated migration validation     |
| Next pattern slot      | —                                       | Self-describing, agent-negotiated   |
+------------------------+-----------------------------------------+-------------------------------------+

### Observability

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Logging                | Logger class (console + file + events)  | + Structured slog (Go)              |
| Tracing                | OpenTelemetry + Langfuse                | + Automated alerting on error rate  |
| Cost tracking          | Usage events per turn                   | + Real-time cost dashboards         |
| Next pattern slot      | —                                       | Self-healing, auto-remediation      |
+------------------------+-----------------------------------------+-------------------------------------+

### Documentation

+------------------------+-----------------------------------------+-------------------------------------+
|                        | L3: Structured (Today)                  | L4: Validated (Today)               |
+------------------------+-----------------------------------------+-------------------------------------+
| Format                 | Prose + schema-driven mix               | + Predominantly schema-driven       |
| Freshness              | Manually maintained                     | + CI-enforced freshness checks      |
| Agent-readability      | AGENTS.md + typed schemas               | + Full agent-executable coverage    |
| Next pattern slot      | —                                       | Auto-generated from code            |
+------------------------+-----------------------------------------+-------------------------------------+

---

## The Decoupling Principle

The maturity model is abstract by design. It must outlast any specific
pattern in the harness. This is how.

### What Is Decoupled

+---------------------+------------------------------------------------------+
| Never Changes       | The 5 levels. The 7 dimensions. The intent-based     |
|                     | definitions.                                         |
+---------------------+------------------------------------------------------+
| Evolves Freely      | Implementation mappings. Which pattern maps to       |
|                     | which level. Technology choices.                      |
+---------------------+------------------------------------------------------+

### How It Works

```
Abstract Model (stable)
    │
    ▼
Current Mappings (evolves with patterns)
    │
    ├── Today: ToolDefinition schema, 5-block prompts, Dual JWT
    ├── Tomorrow: MCP tools, dynamic prompt compile, policy-as-code
    └── Future: (anything post-harness)
    │
    ▼
Internal Track ─── Echo self-assessment
External Track ─── Client assessment
```

When a new pattern emerges (e.g., a new tool protocol, a new prompt
optimization, a new auth standard):

1. It gets added to the Current Implementation Mappings section
2. It maps to the appropriate level × dimension slot
3. The abstract model stays untouched
4. Users/clients see the level improvement, not the pattern swap

This is the Cursor-like upgrade model: the system gets better under the
hood; the user never cares what changed.

---

## Internal Track – Echo Self-Assessment

Echo's current placement per dimension. The target is L4 (Validated)
across all dimensions before pursuing L5 (Agentic) selectively.

### Current Assessment

+----------------+--------+-----------------------------------------------+
| Dimension      | Level  | Evidence                                      |
+----------------+--------+-----------------------------------------------+
| Tools          | L3     | ToolDefinition schema, lazy-loaded registry,  |
|                |        | circuit breakers exist but not CI-enforced     |
+----------------+--------+-----------------------------------------------+
| Skills         | L2-L3  | Static templates exist, no schema-defined     |
|                |        | skill contracts, composition is manual         |
+----------------+--------+-----------------------------------------------+
| Prompts        | L3     | 5-block architecture, template per strategy,  |
|                |        | no CI-validated structure scanning             |
+----------------+--------+-----------------------------------------------+
| API Security   | L3     | Dual JWT, tier gating, basic schema           |
|                |        | validation, rate limiting not yet enforced     |
+----------------+--------+-----------------------------------------------+
| Data Models    | L3     | Go structs + Zod schemas, domain               |
|                |        | documentation exists, manual migrations        |
+----------------+--------+-----------------------------------------------+
| Observability  | L3     | Logger + OTel + Langfuse                      |
|                |        | unstructured in Go (log.Printf), stack         |
|                |        | commented out in docker-compose                |
+----------------+--------+-----------------------------------------------+
| Documentation  | L3     | Mixed prose + schema-driven, AGENTS.md         |
|                |        | references, not fully CI-enforced              |
+----------------+--------+-----------------------------------------------+

### Roadmap to Validated (L4)

The most valuable jump is L3 → L4. Priority order:

1. **Observability** — Replace log.Printf with structured slog, enable OTel
   collector stack
2. **API Security** — Enforce rate limiting at proxy, add injection scanning
   at the gateway boundary
3. **Prompts** — CI-validate prompt structure, add injection scanning per
   compiled prompt
4. **Tools** — CI-enforce tool schemas, make circuit breaker thresholds
   configurable per tool
5. **Skills** — Define schema-driven skill contracts, validate composition
   rules at build
6. **Data Models** — CI-gate migration validation, make schemas
   machine-verifiable on every mutation
7. **Documentation** — Add CI freshness checks, expand schema-driven
   coverage

---

## External Track – Client Company Assessment

The same framework applied to companies Echo serves. This enables:

- **Onboarding diagnostics** — Where is the client today per dimension?
- **Migration planning** — What does it take to go L2→L3, L3→L4?
- **Progress tracking** — How is the client improving over time?

### Assessment Methodology

```
1. Score each dimension independently
   - Be honest about where they actually are, not where they want to be
   - Use the dimension spectrum definitions (intent-based, not tech-based)
   - Evidence required per score (what specifically shows this level)

2. Aggregate to overall maturity level
   - A system is only as mature as its weakest dimension
   - Overall level = lowest dimension score (weakest link rule)

3. Identify quickest L3 targets
   - L3 (Structured) is the baseline for useful AI integration
   - Focus migration on getting every dimension to at least L3
   - Then pursue L4 (Validated) for the highest-value dimensions first

4. Plan the L3 → L4 jump per dimension
   - This is where AI stops being "mostly right" and becomes usable
   - Each dimension has a specific migration path (see mappings above)
   - Priority: Security → Data → Prompts → Tools → Docs → Observability
```

### What Each Level Means for a Client

+--------+----------------------------------------------------------------+
| Level  | Client Experience                                              |
+--------+----------------------------------------------------------------+
| L1     | Echo cannot reliably help. Too much guesswork. Output needs    |
|        | full human rewrite. High risk of hallucination.                |
+--------+----------------------------------------------------------------+
| L2     | Echo can help but needs constant verification. Some things     |
|        | work; others produce plausible-but-wrong output. Low trust.    |
+--------+----------------------------------------------------------------+
| L3     | Echo works for most standard cases. Human review catches the  |
|        | edge cases. Trustworthy for routine work.                      |
+--------+----------------------------------------------------------------+
| L4     | Echo works autonomously within guardrails. Human review is     |
|        | selective. Reliable for production workflows.                  |
+--------+----------------------------------------------------------------+
| L5     | Echo operates autonomously. Human review is exception.         |
|        | Full trust in routine operations.                             |
+--------+----------------------------------------------------------------+

---

## Scoring Guide

### Self-Assessment Questions per Dimension

**Tools:**
- Can an agent discover all available tools without reading code? (L3+)
- Are tool schemas enforced at invocation, not just documented? (L4+)
- Do tools have circuit breakers and degradation policies? (L4+)
- Can tools be composed by the agent autonomously? (L5)

**Skills:**
- Are skills formally defined, not just documented in prose? (L3+)
- Can skills be composed via configuration without code changes? (L4+)
- Does the system validate skill composition rules at build? (L4+)
- Can the agent discover and assemble skill chains autonomously? (L5)

**Prompts:**
- Is prompt structure intentional, not incidental? (L3+)
- Are prompts CI-validated for structure and injection risks? (L4+)
- Are prompts dynamically compiled per context? (L5)

**API Security:**
- Is every external interface authenticated and authorized? (L3+)
- Is rate limiting enforced? (L4+)
- Is there policy-as-code at the boundary? (L4+)
- Is security zero-trust and autonomous? (L5)

**Data Models:**
- Are domain models documented with schemas, not prose? (L3+)
- Are schemas enforced on every mutation, not just in docs? (L4+)
- Are models self-describing to agents? (L5)

**Observability:**
- Are logs structured, not raw text? (L3+)
- Is there distributed tracing across services? (L3+)
- Are there automated alerts based on metrics? (L4+)
- Does the system self-heal based on observations? (L5)

**Documentation:**
- Is documentation schema-driven, not just prose? (L3+)
- Is documentation freshness CI-enforced? (L4+)
- Can agents execute documentation (not just read it)? (L4+)
- Is documentation auto-generated from code? (L5)

### Weakest Link Rule

A system is as mature as its lowest-scoring dimension. A L4 in Tools but
L2 in API Security is a L2 system overall.

---

## Entry Points & Exports

- **Pattern index**: `docs/shared/patterns/README.md`
- **Related patterns**: `docs/shared/patterns/acid-solid-clean-code.md`
  (validation rules that enable L4)
- **Related patterns**: `docs/shared/patterns/observability.md`
  (structured observability for L3+)
- **Assessment usage**: Internal team reviews, client onboarding docs

## Dependencies

- **None.** This is a standalone framework. It references but does not
  depend on any other document or system.

## Source References

+------------------------------------------+-----------------------------------------+
| Reference                                | Role                                    |
+------------------------------------------+-----------------------------------------+
| docs/AGENTS.md                           | Agent routing, skill references         |
| docs/shared/patterns/acid-solid-         | Validation rules that enable L4         |
| clean-code.md                            | enforceability                          |
| docs/shared/patterns/observability.md    | Structured observability dimensions     |
| docs/shared/architecture/                | Zero tight coupling enables adapter     |
| zero-tight-coupling.md                   | pattern for evolving mappings           |
+------------------------------------------+-----------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
