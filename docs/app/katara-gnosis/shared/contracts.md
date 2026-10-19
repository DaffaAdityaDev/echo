# KataraGnosis API Contracts

> Complete HTTP API specifications between Frontend BFF Proxies and Katara Backend (`http://localhost:8090`).

---

## 1. Standalone Authentication Endpoints

### 1.1 `POST /api/v1/auth/register`

- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123",
    "name": "Daffa Aditya"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Daffa Aditya",
      "role": "user",
      "tier": "free",
      "created_at": "2026-08-19T10:00:00Z"
    }
  }
  ```

### 1.2 `POST /api/v1/auth/login`

- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "strongPassword123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Daffa Aditya",
      "role": "user",
      "tier": "free"
    }
  }
  ```

### 1.3 `GET /api/v1/auth/me`

- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response (200 OK)**:
  ```json
  {
    "id": 1,
    "email": "user@example.com",
    "name": "Daffa Aditya",
    "role": "user",
    "tier": "free"
  }
  ```

### 1.4 `POST /api/v1/auth/logout`

- **Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## 2. Knowledge Lakes & Sources

### 2.1 `GET /api/v1/katara/lakes`

- **Response (200 OK)**:
  ```json
  {
    "lakes": [
      {
        "id": "lake_123",
        "name": "PCPM Bank Indonesia",
        "slug": "lake-1-1755600000",
        "description": "Materi persiapan seleksi PCPM BI",
        "status": "active",
        "source_count": 4,
        "flashcard_count": 48,
        "mastery": 0.76,
        "created_at": "2026-08-19T10:00:00Z"
      }
    ]
  }
  ```

### 2.2 `POST /api/v1/katara/lakes`

- **Request Body**:
  ```json
  {
    "name": "PCPM Bank Indonesia",
    "description": "Materi persiapan seleksi PCPM BI"
  }
  ```
- **Response (201 Created)**: Returns created `Lake` object.

### 2.3 `POST /api/v1/katara/sources` (Multipart Form)

- **Form Data**:
  - `file`: Document binary (PDF / Markdown / Text)
  - `lake_id`: Target lake ID
  - `title`: Optional custom title
- **Response (202 Accepted)**:
  ```json
  {
    "source": {
      "id": "src_456",
      "lake_id": "lake_123",
      "title": "Kebijakan Moneter BI.pdf",
      "source_type": "pdf",
      "status": "processing"
    },
    "job": {
      "id": "job_789",
      "type": "ingest_source",
      "status": "running",
      "progress_stage": "Ekstraksi Materi AI"
    }
  }
  ```

### 2.4 `GET /api/v1/katara/sources/:id/chunks`

- **Response (200 OK)**:
  ```json
  {
    "flashcards": [
      {
        "id": "fc_1",
        "source_id": "src_456",
        "lake_id": "lake_123",
        "content": "BI-Rate adalah suku bunga kebijakan acuan...",
        "domain": "Kebanksentralan",
        "sub_topic": "Kebijakan Moneter",
        "archetype": "conceptual",
        "keypoints": ["Suku bunga acuan", "ITF framework"],
        "srs_state": {
          "due_at": "2026-08-20T10:00:00Z",
          "state": "review",
          "stability": 2.4,
          "difficulty": 4.1
        }
      }
    ]
  }
  ```

---

## 3. Flashcards & Semantic Search

### 3.1 `POST /api/v1/katara/flashcards/search`

- **Request Body**:
  ```json
  {
    "query": "transmisi suku bunga BI",
    "lake_id": "lake_123",
    "limit": 10
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "results": [
      {
        "flashcard_id": "fc_1",
        "score": 0.89,
        "content_preview": "BI-Rate adalah suku bunga kebijakan...",
        "keypoints": ["Suku bunga acuan", "ITF framework"],
        "domain": "Kebanksentralan",
        "sub_topic": "Kebijakan Moneter",
        "archetype": "conceptual",
        "source_id": "src_456",
        "lake_id": "lake_123"
      }
    ]
  }
  ```

---

## 4. Spaced Drills & Practice Runner

### 4.1 `POST /api/v1/katara/drills`

- **Request Body**:
  ```json
  {
    "lake_ids": ["lake_123"],
    "size": 10
  }
  ```
- **Response (201 Created)**: Returns `DrillSession` object.

### 4.2 `GET /api/v1/katara/drills/:id/next`

- **Response (200 OK - Question Available)**:
  ```json
  {
    "question": {
      "id": "q_101",
      "question_type": "mcq",
      "difficulty": "medium",
      "prompt": {
        "text": "Instrumen utama kebijakan moneter BI dalam kerangka ITF adalah:",
        "options": ["BI-Rate", "Pagu Kredit Komersial", "Nilai Tukar Tetap", "Operasi Pasar Fiskal"]
      },
      "explanation": "BI-Rate merupakan suku bunga kebijakan acuan utama..."
    },
    "position": 1,
    "total": 10,
    "done": false
  }
  ```
- **Response (200 OK - Session Finished)**:
  ```json
  {
    "done": true,
    "results_url": "/api/v1/katara/drills/sess_123/results"
  }
  ```

### 4.3 `POST /api/v1/katara/drills/:id/answer`

- **Request Body**:
  ```json
  {
    "question_id": "q_101",
    "answer": {
      "selected_index": 0
    },
    "latency_ms": 14200
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "is_correct": true,
    "partial_credit": false,
    "hesitation_class": "mastered",
    "explanation": "BI-Rate merupakan suku bunga kebijakan acuan utama...",
    "next_due_at": "2026-08-22T10:00:00Z"
  }
  ```

### 4.4 `GET /api/v1/katara/drills/:id/results`

- **Response (200 OK)**:
  ```json
  {
    "score": 90.0,
    "accuracy": 0.9,
    "correct": 9,
    "partial": 0,
    "total": 10,
    "duration_ms": 124000,
    "hesitation_distribution": {
      "mastered": 7,
      "hesitant": 2,
      "impulsive": 1
    },
    "weak_spots_hit": ["Transmisi Moneter"]
  }
  ```

---

## 5. Progress, Today & Settings

### 5.1 `GET /api/v1/katara/today`

- **Response (200 OK)**:
  ```json
  {
    "date": "2026-08-19",
    "answered": 4,
    "target": 6,
    "score": 85.0,
    "achieved": false,
    "streak": 4,
    "grace_used_this_week": false,
    "due_reviews": 7,
    "new_cards": 3,
    "weak_spots": ["Transmisi Moneter"],
    "mastery": [
      {
        "lake_id": "lake_123",
        "lake_name": "PCPM Bank Indonesia",
        "mastery": 0.76
      }
    ]
  }
  ```

### 5.2 `GET /api/v1/katara/progress`

- **Response (200 OK)**:
  ```json
  {
    "streak": 4,
    "best_streak": 12,
    "total_answered": 184,
    "accuracy_7d": 0.87,
    "hesitation_distribution": {
      "mastered": 142,
      "hesitant": 28,
      "impulsive": 14
    },
    "activity_7d": [{ "date": "2026-08-18", "answered": 10, "accuracy": 0.9 }],
    "mastery_matrix": [
      {
        "domain": "Kebanksentralan",
        "sub_topic": "Kebijakan Moneter",
        "lake_id": "lake_123",
        "lake_name": "PCPM Bank Indonesia",
        "mastery": 0.82,
        "due_count": 3,
        "lapses": 1,
        "accuracy_7d": 0.89
      }
    ]
  }
  ```

### 5.3 `GET /api/v1/katara/synthesis/weekly`

- **Response (200 OK)**: Returns `WeeklySheet` object. Returns 404 if not yet generated.

### 5.4 `POST /api/v1/katara/synthesis/weekly/regenerate`

- **Response (202 Accepted)**:
  ```json
  {
    "job_id": "job_999",
    "message": "Weekly synthesis job queued"
  }
  ```

### 5.5 `GET /api/v1/katara/settings`

- **Response (200 OK)**:
  ```json
  {
    "session_size": 10,
    "target_questions": 6,
    "target_score": 60.0,
    "grace_days": 1,
    "review_multiplier": 1.0,
    "embedding_provider": "gemini",
    "embedding_model": "text-embedding-004"
  }
  ```

### 5.6 `PATCH /api/v1/katara/settings`

- **Request Body**:
  ```json
  {
    "session_size": 12,
    "review_multiplier": 0.9
  }
  ```
- **Response (200 OK)**: Returns updated `SettingsResponse`.
