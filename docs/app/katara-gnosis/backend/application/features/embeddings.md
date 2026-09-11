# Katara Backend: Vector Embeddings Subsystem

> Embedding generation and vector operations directly integrated into `katara-backend`.

---

## 1. Provider Resolution & Configuration

The Katara backend generates dense embeddings directly via standard provider clients configured through environment variables or user settings:

- **Supported Providers**:
  - `gemini`: Google Generative AI (`text-embedding-004`, 768 dimensions).
  - `openai`: OpenAI Embeddings (`text-embedding-3-small`, 1536 dimensions).
  - `ollama`: Local embeddings (e.g. `nomic-embed-text`, `bge-m3`).

---

## 2. Vector Store Configuration (Qdrant)

- **Collection Name**: `katara_flashcards`
- **Vector Size**: Configured matching provider dimensions (768 or 1536).
- **Distance Metric**: `Cosine`
- **Payload Indexing**:
  - `user_id` (integer / keyword index)
  - `lake_id` (keyword index)
  - `domain` (keyword index)
  - `sub_topic` (keyword index)
- **Fail-Hard Rule**: If Qdrant is offline, search returns HTTP 503 Service Unavailable.
