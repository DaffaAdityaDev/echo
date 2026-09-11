# Katara Backend: Error Handling & Status Governance

> Consistent error formats, HTTP status mapping, and fail-hard infrastructure handling.

---

## 1. Standard Error Response JSON

Every error returned by the Katara backend adheres to a uniform structure:

```json
{
  "error": "Pesan deskriptif dalam Bahasa Indonesia atau pesan sistem",
  "code": "RESOURCE_NOT_FOUND",
  "details": null
}
```

---

## 2. HTTP Status Code Mapping

| Status Code                 | Scenario                                                |
| --------------------------- | ------------------------------------------------------- |
| `400 Bad Request`           | Missing required payload fields or malformed JSON.      |
| `401 Unauthorized`          | Missing or invalid JWT token in `Authorization` header. |
| `404 Not Found`             | Target lake, source, or session does not exist.         |
| `409 Conflict`              | Attempt submitted on an already answered question.      |
| `422 Unprocessable Entity`  | Semantic extraction failure or invalid file format.     |
| `500 Internal Server Error` | Database connection error or unhandled runtime panic.   |
| `503 Service Unavailable`   | Qdrant vector database or GarageHQ S3 is unreachable.   |

---

## 3. Fail-Hard Policy

In accordance with ADR-001, infrastructure errors (such as vector store downtime) must return explicit `503 Service Unavailable` with transparent error messaging. Silent fallback to SQL `ILIKE` or dummy embeddings is strictly forbidden.
