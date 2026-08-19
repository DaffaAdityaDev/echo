================================================================================
  KataraGnosis AI Call Pattern
================================================================================
  Module    : AI Call Pattern
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

All KataraGnosis LLM calls (atomize tagging, question generation, essay
evaluation, weekly synthesis) are NON-streaming direct calls to the user's
configured provider — following the exact precedent of
backend/internal/handler/session/title.go (raw OpenAI-compatible HTTP,
no SDK). The agent service (Hono) is NOT involved in v1 (ADR-04 scope).

Provider Resolution
-------------------

  1. Load user_preferences (provider_type, api_key decrypted via
     pkg/crypto, base_url) — same SettingsProvider interface the
     aimodel service uses.
  2. Fall back to global DEFAULT_MODEL / server defaults when the user
     has no provider config.
  3. Build the OpenAI-compatible chat/completions request.

Shared Helper (service/katara/ai.go)
------------------------------------

  type LLMCaller struct { ... }         // http.Client with 60s timeout

  func (c *LLMCaller) CompleteJSON(
      ctx context.Context,
      system string, user string,
      out any,           // strict JSON destination
  ) error

  - system = active prompt template content (see below).
  - POST {base_url}/v1/chat/completions
      body: { model, messages, temperature, max_tokens, stream: false }
    (anthropic provider uses its own envelope via the same code path as
    title.go — mirror the existing provider branching there).
  - Response parsed; the `content` field is stripped of markdown fences,
    then unmarshaled into `out` with DisallowUnknownFields.
  - On parse failure: single retry with an explicit "strict JSON only"
    reminder appended; then error (LLM contract violation).

Prompt Templates
----------------

Prompts live in the existing prompt_templates table (versioned via the
studio/llmops module) and are resolved with the PromptAdapter pattern:

  katara.atomize      -> ingestion tagging (ingestion-pipeline.md)
  katara.generate     -> on-demand question generation (drills.md)
  katara.evaluate     -> essay/scenario grading (drills.md)
  katara.synthesis    -> weekly weakness sheet (progress.md)

  - Active version fetched via internal prompts endpoint, cached in Redis
    60s (existing pattern); fallback: built-in constants in
    internal/constants/katara/prompts.go.
  - Each template MUST end with the instruction to return strict JSON
    matching the documented contract, and forbid markdown fences.

JSON Contracts (Go-side validation)
-----------------------------------

Every LLM JSON output is validated with strict structs in
internal/models/katara/:

  type AtomizeResult struct {
      Domain    string   `json:"domain"`
      SubTopic  string   `json:"sub_topic"`
      Archetype string   `json:"archetype"`
      Keypoints []string `json:"keypoints"`
  }

  type GeneratedQuestion struct {
      QuestionType    string          `json:"question_type"`
      Difficulty      string          `json:"difficulty"`
      Prompt          json.RawMessage `json:"prompt"`
      Explanation     string          `json:"explanation"`
      DistractorLabels []Distractor   `json:"distractor_labels"`
  }

  type EvaluationResult struct {
      Grade         int    `json:"grade"`
      Feedback      string `json:"feedback"`
      FollowUp      string `json:"follow_up"`
      KeyPrinciple  string `json:"key_principle"`
  }

  type SynthesisResult struct {
      SummaryMD   string   `json:"summary_md"`
      WeakTopics  []string `json:"weak_topics"`
      Mistakes    []Mistake `json:"mistakes"`
  }

Constraints
-----------

  - temperature: 0.2 (atomize/generate/evaluate), 0.3 (synthesis).
  - max_tokens: 1500 (atomize/generate), 1200 (evaluate), 2500 (synthesis).
  - Every call carries a 60s timeout; ingest pipeline runs these inside the
    worker context (no HTTP lifecycle).
  - Usage metrics: log token counts via slog (and Langfuse OTel when
    ENABLE_OTEL=true) — reuses existing telemetry plumbing.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
