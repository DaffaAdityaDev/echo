# Katara Infrastructure: Qdrant Vector Database

> Exclusive vector store schema, collection indexing, and payload filtering for Katara flashcards.

---

## 1. Collection Definition

- **Collection**: `katara_flashcards`
- **Vector Dimensions**: `768` (Gemini `text-embedding-004`) or `1536` (OpenAI `text-embedding-3-small`)
- **Metric**: `Cosine`

---

## 2. Payload Index Fields

To ensure sub-millisecond multi-tenant filtering, payload indexes are created for:

1. `user_id` (integer / keyword index)
2. `lake_id` (keyword index)
3. `domain` (keyword index)
4. `sub_topic` (keyword index)

---

## 3. Fail-Hard Policy

If the Qdrant service is unreachable, Katara semantic search operations fail immediately with HTTP `503 Service Unavailable`. No fallback to SQL `ILIKE` is permitted.
