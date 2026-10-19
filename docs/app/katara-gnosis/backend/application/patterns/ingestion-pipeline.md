# Katara Backend: Document Ingestion Pipeline Pattern

> End-to-end ingestion pipeline transforming raw documents into atomic flashcard units and vector embeddings.

---

## 1. Pipeline Stages

```
┌────────────────────────────────────────────────────────┐
│               1. Upload & Storage Stage                │
│  - Receives multipart binary (PDF, Markdown, Text)     │
│  - Uploads to GarageHQ S3 (`inquizitive-docs`)         │
│  - Saves source record (`status = 'processing'`)       │
│  - Returns HTTP 202 Accepted with Job ID               │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               2. Text Extraction & Parsing             │
│  - PDF: Extracted via `pdfcpu` / `unidoc` text parser   │
│  - Markdown / Text: Direct UTF-8 stream normalization  │
│  - Token estimation & chunk candidate boundary slicing │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               3. AI Flashcard Extraction               │
│  - LLM Prompt: Identifies atomic conceptual blocks     │
│  - Assigns archetype: conceptual / procedural / scenar │
│  - Generates domain, sub_topic, and keypoint bullets   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               4. Embedding & Vector Indexing           │
│  - Generates dense vector via configured provider      │
│  - Upserts payload to Qdrant (`katara_flashcards`)     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               5. Persistence & FSRS State Init         │
│  - Inserts flashcard rows into `katara_flashcards`     │
│  - Initializes `katara_srs_states` (`state = 'new'`)   │
│  - Marks `katara_sources.status = 'ready'`             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion Prompt Template

Defined in `internal/constants/prompts.go`:

```text
Anda adalah kurator materi ahli untuk persiapan ujian dan pembelajaran intensif.
Analisis dokumen terlampir dan ekstrak menjadi unit-unit flashcard atomik (300-500 token).

Setiap flashcard harus memiliki format JSON berikut:
{
  "content": "Penjelasan inti konsep secara padat dan jelas...",
  "domain": "Domain utama materi (misal: Kebanksentralan)",
  "sub_topic": "Sub-topik spesifik (misal: Transmisi Kebijakan Moneter)",
  "archetype": "conceptual" | "procedural" | "scenario",
  "keypoints": [
    "Fakta atau prinsip penting 1",
    "Fakta atau prinsip penting 2"
  ]
}
```
