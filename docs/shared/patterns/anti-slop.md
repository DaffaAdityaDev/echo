================================================================================
  ANTI-SLOP STANDARD
================================================================================
  Module    : Anti-Slop
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-08-04
================================================================================

## Description

Mandatory standard for ALL AI-assisted code in Echo — whether written by an
agent or a human. Complements `acid-solid-clean-code.md` (ACID / SOLID /
Clean Code) and the repo's `AGENTS.md` references. Where ACID/SOLID/Clean
Code define *what* good code looks like, this standard defines what to
*guard against* in AI-generated output. Violations produce code that is
reviewable-but-shallow: it reads fine in review, passes every gate, and
silently degrades the codebase.

## What AI Slop Is

**AI slop = code that compiles, passes tests, and looks professional, but is
structurally shallow — it works today and rots tomorrow.**

It bypasses existing gates for three reasons:

1. **It looks finished.** Correct indentation, meaningful names, plausible
   structure. Nothing *visibly* wrong, so reviewers sign off.
2. **It is uniform at scale.** The same shallow pattern repeated across a
   hundred files looks like consistency, not debt.
3. **Checks are green.** It compiles, lints, and passes tests — none of which
   measure structural depth.

Volume matters: one harmless shortcut is nothing; a hundred across files is
comprehension drag and production risk. Every accepted shortcut lowers the
bar for the next one.

## Named Anti-Patterns

| # | Pattern | Symptom / Example | Rule in This Repo |
|---|---|---|---|
| 1 | Comments that lie | Trivial narrative comments restating the code — `// Initialize database` above `initDB()`; `// increment counter` above `i++` | No filler comments. Comments only for non-obvious "why". Rely on meaningful names (see Naming Conventions in `acid-solid-clean-code.md`) |
| 2 | Swallowed errors | Empty `catch {}`; `catch (e) { console.log(e) }`; ignored Go errors (`_ = f()`) | Always wrap/rethrow with context. Use the error taxonomy in `agent/src/shared/constants/errors.ts`; Go: `fmt.Errorf("...: %w", err)` (see Error Wrapping in `acid-solid-clean-code.md`) |
| 3 | Type-system escape hatches | `as any`, `as unknown as T`, `@ts-ignore` / `ts-expect-error` to silence errors | Forbidden. Parse with zod or narrow with type guards — the repo already does this (`agent/src/adapter/inbound/api/missions/mission.schema.ts`) |
| 4 | Hallucinated / undeclared imports | Imports of modules not in `package.json`/`go.mod`, or invented stdlib names | Only import modules that exist. Typechecker and build MUST pass (`npx tsc --noEmit`, `bun run build`, `go build`) |
| 5 | Dead code & duplication | Unreachable branches; unused variables; the same utility re-implemented in several files | DRY. Grep for existing implementations first — `agent/src/shared/types`, `agent/src/shared/constants`, `agent/src/core/` modules, `backend/internal/` packages — before writing new ones. No re-implemented utilities |
| 6 | Generic names & stubs | `data`, `result`, `temp`; empty functions; thin wrappers adding nothing; `TODO` stubs left where real logic belongs | Follow naming conventions in `acid-solid-clean-code.md`. No empty implementations; a function that does nothing should not exist |
| 7 | Debug leftovers & hardcoded values | `console.log` shipped; hardcoded URLs/IDs in code; secrets in source | Use `agent/src/shared/utils/logger` (structured logging), ENV-based config, and never hardcode secrets — see `docs/shared/contracts/env-contract.md` |
| 8 | Complexity inflation | Long functions; deep nesting; oversized parameter lists; dumping-ground files | Small functions, early returns, split handlers/components. Code review MUST flag functions > ~50 lines or > 3 nesting levels |
| 9 | Security shortcuts | SQL string interpolation; `eval`; shell commands built from user input; unvalidated input | pgx parameterized queries only (see ACID section of `acid-solid-clean-code.md`), no `eval`, zod validation on ALL inbound payloads (`mission.schema.ts` precedent) |
| 10 | Language tells | Go library code that `panic`s instead of returning errors; TS `any` leaking through interfaces; unused imports/params | Go libraries return errors — `panic` only at fatal startup. TS strict typing throughout. Biome flags unused imports/params (`bun run lint`) |

## Agent Workflow Rules (MUST)

Every agent — including this assistant — MUST follow these rules on every task:

- **Verify work.** Always run the available checks after changes and iterate
  until green (Enforcement section below). A change that does not pass the
  gates is not done.
- **Explore → plan → code.** Use plan mode for multi-file work; scope tasks
  precisely before writing anything. No diving into code without a plan.
- **Fix root causes, never suppress symptoms.** No silencing errors, no
  skipping failing checks, no `// disabled because...` patches. Find why it
  failed and fix that.
- **Atomic changes.** One concern per change/commit; small reviewable units;
  no mixed-responsibility or "AI dump" commits. Commit after each logical
  step so a `git reset --hard` is always safe (see Atomic Changes in
  `acid-solid-clean-code.md`).
- **Prefer existing patterns & shared modules.** Follow the repo's existing
  feature/pattern docs and reuse `shared/` and `core/` modules before
  creating new abstractions.
- **No speculative abstraction (YAGNI).** Build only what the task requires.
  If it is not needed by a current requirement, it does not belong in the
  diff.
- **Fresh-context self-review.** Before declaring done, review the diff as if
  reading someone else's code. Flag only gaps affecting correctness or
  requirements — do not add speculative "improvements" in response to your
  own review.
- **Docs-first.** New contracts, patterns, or conventions MUST update the
  docs — this repo's convention is every feature has a doc, and `AGENTS.md`
  references the standards.

## Enforcement

Existing gates — a change is not done until ALL applicable commands pass:

| Layer | Command | Notes |
|---|---|---|
| Go backend | `golangci-lint run ./internal/...` | Documented lint gate (see `acid-solid-clean-code.md`) |
| Go backend | `go test ./...` | Canonical invocation: `make test` (backend `Makefile`: `go test -v -short -parallel 8 -count=1 ./...`) |
| Agent | `bun run lint` | Biome check (`biome check --write .`) |
| Agent | `bun run test` | Vitest (`vitest run`) |
| Agent | `bun run build` | Docs merge + Bun build |
| Frontend | `npx tsc --noEmit` | Typecheck (TypeScript 7.0.2 devDependency) |
| Frontend | `bun run build` | Next.js build |
| Frontend | `bun run lint` | Biome check |

Optional future tooling (NOT added now — YAGNI): open-source AI-slop scanners
such as `skew202/antislop` (github.com/skew202/antislop) or `scanaislop/aislop`
(`npx aislop scan`) could gate CI later. If adopted: deterministic rules may
run as a hard gate; LLM-based review is advisory only, never the sole
enforcement.

## References

- Anthropic engineering — "Claude Code: Best practices for agentic coding":
  https://www.anthropic.com/engineering/claude-code-best-practices
- Stop the Slop — "Stop the Slop: An Internal Guide for Devs" (Nov 2025):
  https://stoptheslop.dev/blog/stop-the-slop-an-internal-guide-for-devs
- Scanaislop — "AI Slop: How to Detect and Prevent Low-Quality AI Code"
  (May 2026): https://scanaislop.com/blog/ai-slop-detection-complete-guide/
- grcengineering — "Sloppy AI Code - And How to Avoid It":
  https://grcengineering.substack.com/p/sloppy-ai-code-and-how-to-avoid-it

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
