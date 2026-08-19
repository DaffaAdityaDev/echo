================================================================================
  KataraGnosis Embedding Service & Endpoint
================================================================================
  Module    : Embeddings
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

KataraGnosis needs a vector for every flashcard (Qdrant index) and for
semantic search queries. Embedding generation is provider-agnostic: the
service supports Gemini and any OpenAI-compatible /v1/embeddings endpoint
(OpenAI, LM Studio, Ollama-compatible proxies, ...). Configuration is
environment-driven (global, not per-user) — see infrastructure/env-contract.md.

Provider Matrix
---------------

+-------------------+--------------------------------+--------------------------------+
| EMBEDDING_PROVIDER| Config keys                    | Notes                          |
+-------------------+--------------------------------+--------------------------------+
| gemini            | EMBEDDING_API_KEY,             | Default model                 |
|                   | EMBEDDING_MODEL (default       | gemini-embedding-001          |
|                   | gemini-embedding-001)          | (768 dims).                   |
| openai-compatible | EMBEDDING_BASE_URL,            | Any server speaking           |
|                   | EMBEDDING_API_KEY (optional),  | /v1/embeddings (OpenAI, LM    |
|                   | EMBEDDING_MODEL (required)     | Studio, local proxies).       |
+-------------------+--------------------------------+--------------------------------+

Interface (service/katara/embed.go)
-----------------------------------

  type Embedder interface {
      // Embed returns one vector per input text, in order.
      Embed(ctx context.Context, texts []string) ([][]float32, error)
  }

  func NewEmbedder(cfg *cfgmodel.Config) (Embedder, error)

  - gemini: raw HTTP POST to
    https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
    with x-goog-api-key header. Supports single-text batch (iterate).
  - openai-compatible: POST {base_url}/embeddings
    body {model, input: texts} -> data[].embedding.
  - Both paths validate dimension consistency across calls and reject
    empty inputs.
  - Fail-hard: provider misconfiguration / network error surfaces as error;
    callers (ingestion worker, semantic search, manual card save) propagate
    it and fail the operation.

Internal Endpoint
-----------------

  POST /api/v1/internal/embeddings      (Service JWT, internal auth)
  body: { "texts": ["...", "..."] , "provider"?: "gemini" | "openai-compatible" }

  - provider optional: defaults to EMBEDDING_PROVIDER env. This allows a
    future agent-side caller to embed against a different provider without
    config churn.
  - response: { "embeddings": [[0.012, ...], ...], "dimensions": 768 }
  - limit: max 64 texts per call, each <= 8000 chars.
  - Also used by the rewritten echo semantic memory handler
    (handler/memory/semantic.go) to embed content server-side when the
    request body omits an embedding.

Batching & Caching
------------------

  - Ingestion batches 16 texts/call.
  - A tiny LRU (64 entries) memoizes query embeddings keyed by hash of
    (provider, model, query) for the semantic search endpoint — search
    queries repeat across re-runs in a session.
  - No persistence of embeddings outside Qdrant (PG stores none).

Error Handling
--------------

  - 5xx provider errors: propagate (retryable for ingest job, 503 for
    search endpoint).
  - 4xx provider errors (bad key, unknown model): non-retryable; surface
    clear error text (e.g., "Embedding provider returned 401: check
    EMBEDDING_API_KEY").

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
