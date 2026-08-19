================================================================================
  KataraGnosis Drill Engine
================================================================================
  Module    : Drills
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The drill engine runs a single daily session: it builds the 70/30 mix,
serves questions one at a time (generating them on demand via the LLM and
caching them in the `questions` table), evaluates answers (instant for
objective types, AI-graded for open-ended), records attempts with latency
classes, updates FSRS state, and finally computes the session score.

State Machine
-------------

  created -> in_progress -> completed
                    |--> abandoned (no answers, auto-completed by
                          cleanup job after 24h, score null)

Session creation (POST /katara/drills)
--------------------------------------

  body: { lake_ids?: [], size?: 10 }

  1. Load due flashcards (srs_states.due_at <= now, status not retired).
     Cap at floor(size * 0.7) but never under-fill: if fewer due, take all.
  2. Fill the remainder with new flashcards (no srs_state row) preferring
     weak sub_topics (progress service) and lake weights.
  3. Persist drill_sessions row with frozen mix JSONB (mix contains
     flashcard ids + lake_weights).
  4. Return {session_id, mix_summary: {review_count, new_count, size}}.

Next question (GET /katara/drills/:id/next)
-------------------------------------------

  1. Pop the next flashcard from the frozen mix queue (in order; queue
     state kept in drill_sessions.mix JSONB — answered ids appended to
     `answered` array so a page refresh never re-serves a question).
  2. Find an active cached question for (flashcard_id, question_type).
     Generation policy (ADR-03):
       - First time the card is served: generate via LLM now.
       - Subsequent servings (review): reuse cached question; after 3
         correct attempts a card gets a fresh regenerated question
         (same card, new phrasing) to prevent rote memorization.
  3. If no card left: return {done: true, results_url}.
  4. Response: {question: {...prompt, question_type, difficulty,
     question_id, flashcard_id, served_at}}.

  On-demand generation (service/katara/quiz.go):
    - Prompt template `katara.generate`; chunk content + keypoints +
      archetype + instructions (question-type bias by archetype):

        conceptual  -> mcq 60%, true_false 20%, short_answer 20%
        procedural  -> mcq 40%, true_false 20%, short_answer 40%
        scenario    -> scenario 100%

    - JSON contract output:

        {
          "question_type": "mcq",
          "difficulty": "medium",
          "prompt": {"text": "...", "options": [...], "correct_index": 1},
          "explanation": "...",
          "distractor_labels": [{"index":0,"trap":"partial_truth","note":"..."}]
        }

    - Validated strictly; persisted to `questions` (source='ai',
      flashcard_id set) BEFORE being served.
    - Generation latency 2-5s; UI shows a loading state (frontend
      features/drill.md).

Answer (POST /katara/drills/:id/answer)
---------------------------------------

  body: { question_id, answer: {selected_index | text | boolean}, latency_ms }

  1. Load question. If question_type is mcq/true_false:
     - auto-check: compare answer with prompt.correct_index / prompt.answer.
     - feedback served from stored explanation + distractor_labels
       (instant, zero LLM latency).
  2. If short_answer/scenario:
     - call LLM evaluator (prompt `katara.evaluate`, temperature 0.2):

         input: question + rubric + user answer + flashcard content
         output JSON:
         {
           "grade": 4,                    // 1-5
           "feedback": "...",
           "follow_up": "...",
           "key_principle": "..."
         }

     - grade >= 4 -> correct; 2-3 -> partial (is_correct=false,
       ai_feedback.partial_credit=true); 1 -> wrong.
     - Evaluator uses the flashcard's keypoints as the rubric anchor.
  3. Classify hesitation (daily-protocol.md) from latency_ms + result.
  4. Single ACID transaction:
     - INSERT attempts
     - UPDATE drill_sessions (total, correct, partial, duration_ms)
     - Upsert srs_state via go-fsrs:
         fsrs.Review(fsrs.Card{...}, fsrs.Rating, reviewTime)
         rating: correct -> Good, partial -> Hard, wrong -> Again
       (mastered/hesitant adjust interval via fsrs params; impulsive uses
       Again regardless)
  5. Response: {is_correct, partial_credit, hesitation_class,
     explanation, distractor_labels, ai_feedback?, follow_up?,
     next_due_at}.

Results (GET /katara/drills/:id/results)
----------------------------------------

  { score, accuracy, correct, partial, total, duration_ms,
    hesitation_distribution: {mastered, hesitant, impulsive},
    weak_spots_hit: [sub_topic...], answered: [...attempt summaries...] }

  score per daily-protocol.md (difficulty-weighted accuracy).

SRS Integration (service/katara/srs.go)
---------------------------------------

  - go-fsrs (FSRS-5). Card params stored 1:1 in srs_states.
  - New flashcards get srs_state (state=new) lazily at first answer.
  - Reviews schedule: due_at computed by fsrs; the 70% feed reads due_at.
  - Perf: FSRS default parameters (go-fsrs defaults); user-facing tuning
    deferred (settings page exposes only "review multiplier" 0.7-1.5).

Anti-Cheat / Integrity
-----------------------

  - latency_ms is measured client-side (Date.now diff) and sanity-clamped
    server-side (0 < latency_ms < 30 min).
  - A question can only be answered once per drill session
    (mix.answered guard) — duplicate answers return 409.
  - Drill sessions auto-abandoned after 24h (cleanup task).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
