================================================================================
  KataraGnosis API Contracts
================================================================================
  Module    : Contracts
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Canonical JSON contracts for the key KataraGnosis endpoints. All responses
use the backend envelope: success = plain JSON body (handlerutil
RespondSuccess), error = {"error": "...", "details": "..."}.

--------------------------------------------------------------------------------
POST /api/v1/katara/lakes        (create lake)
--------------------------------------------------------------------------------

  Request:
    { "name": "PCPM Bank Indonesia", "description": "Persiapan tes BI",
      "icon": "landmark" }

  201:
    { "id": "a1b2...", "user_id": 42, "name": "PCPM Bank Indonesia",
      "slug": "pcpm-bank-indonesia", "description": "...", "icon": "landmark",
      "status": "active", "source_count": 0, "flashcard_count": 0,
      "created_at": "2026-08-18T08:00:00Z" }

--------------------------------------------------------------------------------
GET /api/v1/katara/lakes         (list)
--------------------------------------------------------------------------------

  200:
    { "lakes": [ { "id": "...", "name": "...", "slug": "...", "icon": "landmark",
        "status": "active", "source_count": 2, "flashcard_count": 47,
        "mastery": 0.72, "created_at": "..." } ] }

--------------------------------------------------------------------------------
POST /api/v1/katara/sources      (upload, multipart)
--------------------------------------------------------------------------------

  multipart/form-data:
    file: <binary>, lake_id: "<uuid>", title?: "Laporan Ekonomi BI"

  201:
    { "source": { "id": "src_...", "lake_id": "...", "title": "Laporan...",
        "source_type": "pdf", "status": "uploaded", "size_bytes": 4821337,
        "object_key": "42/src_...pdf", "char_count": 0, "flashcard_count": 0,
        "created_at": "..." },
      "job": { "id": "job_...", "type": "ingest_source", "status": "queued" } }

--------------------------------------------------------------------------------
GET /api/v1/katara/jobs/:id      (poll)
--------------------------------------------------------------------------------

  200:
    { "id": "job_...", "type": "ingest_source", "status": "running",
      "progress_stage": "tag", "error": null, "updated_at": "..." }

--------------------------------------------------------------------------------
POST /api/v1/katara/drills       (create session)
--------------------------------------------------------------------------------

  Request:
    { "lake_ids": ["<uuid>"], "size": 10 }

  201:
    { "session": { "id": "drill_...", "date": "2026-08-18",
        "mix": { "size": 10, "review_count": 7, "new_count": 3 },
        "total": 0, "correct": 0, "partial": 0, "score": null,
        "completed_at": null } }

--------------------------------------------------------------------------------
GET /api/v1/katara/drills/:id/next
--------------------------------------------------------------------------------

  200 (question):
    { "question": { "id": "q_...", "flashcard_id": "fc_...",
        "question_type": "mcq", "difficulty": "medium",
        "prompt": { "text": "Apa instrumen utama kebijakan moneter BI?",
                    "options": ["BI-Rate", "Tarif PPN", "Harga minyak",
                                "Nilai tukar"], "correct_index": null },
        "served_at": "2026-08-18T08:05:00Z" },
      "position": 3, "total": 10 }

  NOTE: correct_index/answer is NEVER sent to the client for objective
  questions (checked server-side).

  200 (done):
    { "done": true, "results_url": "/api/v1/katara/drills/drill_.../results" }

  503 (LLM/embedding infra):
    { "error": "Penyimpanan vektor tidak tersedia", "details": "qdrant unavailable" }

--------------------------------------------------------------------------------
POST /api/v1/katara/drills/:id/answer
--------------------------------------------------------------------------------

  Request:
    { "question_id": "q_...", "answer": { "selected_index": 0 },
      "latency_ms": 18500 }

  200 (objective):
    { "is_correct": true, "partial_credit": false,
      "hesitation_class": "hesitant",
      "explanation": "BI-Rate adalah suku bunga acuan yang ditetapkan BI...",
      "distractor_labels": [ { "index": 1, "trap": "false_causation",
          "note": "Sebab-akibat terbalik." } ],
      "next_due_at": "2026-08-22T08:00:00Z" }

  200 (essay graded by AI):
    { "is_correct": true, "partial_credit": false,
      "hesitation_class": "mastered",
      "ai_feedback": { "grade": 4, "feedback": "Menjawab instrumen dengan
          benar, tapi melewatkan efek terhadap sektor riil.",
          "follow_up": "Apa dampak kenaikan BI-Rate terhadap investasi?",
          "key_principle": "Transmisi: suku bunga -> kredit -> aktivitas
          ekonomi -> inflasi." },
      "next_due_at": "..." }

  409: { "error": "Soal sudah dijawab pada sesi ini" }

--------------------------------------------------------------------------------
GET /api/v1/katara/drills/:id/results
--------------------------------------------------------------------------------

  200:
    { "score": 78.5, "accuracy": 0.8, "correct": 8, "partial": 1,
      "total": 10, "duration_ms": 845000,
      "hesitation_distribution": { "mastered": 5, "hesitant": 3,
        "impulsive": 2 },
      "weak_spots_hit": ["Transmisi Kebijakan Moneter"],
      "answered": [ { "question_id": "q_...", "is_correct": true,
        "hesitation_class": "hesitant" } ] }

--------------------------------------------------------------------------------
GET /api/v1/katara/today
--------------------------------------------------------------------------------

  200:
    { "date": "2026-08-18", "answered": 5, "target": 6, "score": 64,
      "achieved": false, "streak": 4, "grace_used_this_week": false,
      "due_reviews": 7, "new_cards": 3,
      "active_session_id": "drill_...",        // null if none in progress
      "weak_spots": ["Transmisi Kebijakan Moneter", "GWM"],
      "mastery": [ { "lake_id": "...", "lake_name": "PCPM BI",
        "mastery": 0.72 } ] }

--------------------------------------------------------------------------------
GET /api/v1/katara/progress
--------------------------------------------------------------------------------

  See backend/application/features/progress.md (full shape).

--------------------------------------------------------------------------------
GET /api/v1/katara/synthesis/weekly
--------------------------------------------------------------------------------

  200:
    { "week_start": "2026-08-12",
      "content": { "summary_md": "## Lembar Kelemahan 12-18 Agu...",
        "weak_topics": ["GWM"], "mistakes": [ { "concept": "GWM",
          "common_mistake": "Menyamakan GWM dengan BI-Rate", "fix": "..." } ] },
      "created_at": "2026-08-19T06:00:00Z" }

--------------------------------------------------------------------------------
POST /api/v1/katara/flashcards/search   (semantic)
--------------------------------------------------------------------------------

  Request:
    { "query": "bagaimana transmisi kebijakan moneter bekerja",
      "lake_id": "<uuid optional>", "limit": 10 }

  200:
    { "results": [ { "flashcard_id": "fc_...", "score": 0.87,
        "content_preview": "Perubahan BI-Rate memengaruhi suku bunga kredit...",
        "keypoints": ["..."], "domain": "Kebanksentralan",
        "sub_topic": "Transmisi Kebijakan Moneter", "archetype": "conceptual",
        "source_id": "src_...", "lake_id": "..." } ] }

--------------------------------------------------------------------------------
POST /api/v1/internal/embeddings        (Service JWT)
--------------------------------------------------------------------------------

  Request:
    { "texts": ["Bank Indonesia menetapkan BI-Rate.", "GWM adalah..."],
      "provider": "gemini" }

  200:
    { "embeddings": [[0.012, -0.5, ...], [0.011, -0.49, ...]],
      "dimensions": 768 }

  Error: 401 invalid Service JWT; 400 empty/bad input; 502 provider error.

--------------------------------------------------------------------------------
Error Envelope (all endpoints)
--------------------------------------------------------------------------------

  400: { "error": "Invalid request" }
  401: { "error": "Unauthorized" }
  409: { "error": "<domain conflict message>" }
  503: { "error": "<infra unavailable message>", "details": "<reason>" }
  500: { "error": "Internal server error", "details": "<wrapped>" }

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
