# Katara Backend: Knowledge Libraries & Flashcards

> Feature specifications for Knowledge Lakes, Sources, and Flashcard management.

---

## 1. Domain Organization

- **Knowledge Lake (`katara_lakes`)**: Top-level knowledge boundary (e.g. "PCPM Bank Indonesia", "Sistem Terdistribusi").
- **Source (`katara_sources`)**: Specific document or notes payload uploaded within a Lake.
- **Flashcard (`katara_flashcards`)**: Atomic knowledge unit (300-500 tokens) extracted from a Source or created manually.

---

## 2. Flashcard Archetypes

| Archetype    | Description                                                   | Practice Style                              |
| ------------ | ------------------------------------------------------------- | ------------------------------------------- |
| `conceptual` | Fundamental theories, regulatory definitions, legal articles. | Direct MCQ, True/False, Short Definition.   |
| `procedural` | Step-by-step algorithms, mathematical calculations, formulas. | Step Ordering, Numerical Solving.           |
| `scenario`   | Business cases, ethical scenarios, AKHLAK values.             | Case Study Analysis, Best Action Selection. |

---

## 3. Semantic Search Engine

- Receives search query and optional `lake_id` filter.
- Converts query text into dense embedding vector via configured embedding model.
- Queries Qdrant collection `katara_flashcards` with cosine distance and payload filter `user_id == current_user_id`.
- Returns sorted matches with relevance score percentage ($0.0 - 1.0$).
