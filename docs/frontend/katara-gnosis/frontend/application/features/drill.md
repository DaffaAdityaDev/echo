================================================================================
  KataraGnosis Frontend Drill Runner
================================================================================
  Module    : Drill
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The drill runner is a full-screen, timer-driven quiz experience. It serves
one question at a time (backend may generate on demand — 2-5s loading
state), measures latency, gives instant feedback for objective questions
and AI-graded feedback for open-ended ones, and ends with a results screen.

Route & Flow
------------

  /drill/[sessionId]  (full-screen, sidebar hidden)

  1. Mount -> GET /api/katara/drills/[sessionId] (session meta) +
     GET .../next (first question, starts timer)
  2. Question answered -> POST .../answer -> feedback panel -> "Lanjut"
     -> GET .../next
  3. {done: true} -> POST results (or GET .../results) -> ResultsScreen

State (drillStore)
------------------

  activeSession, currentQuestion, timerStartAt, latencyMs, answerQueue,
  feedback (last), results, generating (bool)

Timer & Latency
---------------

  - timerStartAt = Date.now() when question rendered.
  - on submit: latencyMs = Date.now() - timerStartAt (sent in answer
    body).
  - Visible count-up timer; question does NOT auto-expire in v1
    (self-paced; hesitation classes handle slow answers).
  - Client clamps latency to (0, 30 min) before sending (server clamps
    too).

Question Cards
--------------

  +---------------------+--------------------------------------------------+
  | Type                | Component                                       |
  +---------------------+--------------------------------------------------+
  | mcq                 | 4 option buttons (A-D), radio behavior, single   |
  |                     | select, disabled after submit                    |
  | true_false          | two large buttons "Benar" / "Salah"              |
  | short_answer        | textarea (plain, Enter = newline, Ctrl+Enter =   |
  |                     | submit); 500 char cap                            |
  | scenario            | textarea + optional "Tampilkan Sumber" accordion  |
  |                     | (related flashcards from question.sources)       |
  +---------------------+--------------------------------------------------+

  MCQ options show trap badges after submit (e.g., "Penyesat: sebab-akibat
  terbalik") derived from distractor_labels.

Feedback Panel (after answer)
-----------------------------

  +---------------------+--------------------------------------------------+
  | Section             | Content                                          |
  +---------------------+--------------------------------------------------+
  | Result              | "Benar" / "Sebagian" / "Salah" + hesitation class|
  |                     | badge (Mastered/Hesitant/Impulsif)               |
  | Explanation         | stored explanation (instant, objective)          |
  | AI feedback         | essay: grade x/5, feedback, key_principle,       |
  |                     | follow_up prompt                                 |
  | Next due            | "Berikutnya: <date>" from answer.next_due_at     |
  +---------------------+--------------------------------------------------+

  Follow-up chip: "Tanya AI" opens a modal chat asking the follow_up
  question (POST /api/katara/drills/:id/followup -> LLM short answer,
  stored as a note on the flashcard — P3 enhancement, out of v1).

Generating State (on-demand generation)
---------------------------------------

  When GET next returns 202-with-latency or the frontend marks a new card
  as generating:
    - skeleton card + "AI sedang menyusun soal..." + spinner
    - server returns the cached question on retry; the frontend polls
      next (3s interval) until a question arrives (max 30s -> error
      state with retry)
  Optimization: the frontend prefetches the NEXT question while the user
  reads feedback of the current one (background GET next), hiding most
  generation latency.

Results Screen
--------------

  - Score ring (score/100), accuracy, correct/partial/total
  - Hesitation distribution bars (mastered/hesitant/impulsive)
  - Weak spots hit (sub_topics with wrong/hesitant answers) -> buttons
    linking to library search filtered by sub_topic
  - "Target harian tercapai" badge + streak display
  - Buttons: "Selesai" (dashboard) / "Ulangi Sesi" (same mix, new session)

Errors
------

  - 503 infra: full-screen banner "Layanan penyimpanan sedang tidak
    tersedia. Coba lagi." + retry button.
  - 502 LLM: toast "Gagal membuat soal. Coba lagi." + retry next.
  - 409 already answered: refetch session, skip to next.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
