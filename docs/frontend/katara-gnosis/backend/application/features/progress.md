================================================================================
  KataraGnosis Progress, Streaks & Weak Spots
================================================================================
  Module    : Progress
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Progress is computed on read (no materialized aggregates in v1) from
attempts + srs_states. The weekly synthesis sheet is the only derived
artifact cached in DB (weekly_sheets table) because it is LLM-generated.

Mastery Matrix
--------------

GET /katara/progress
  query: { lake_id? }

  Response:

  {
    "streak": { "current": 4, "best": 9, "grace_used_this_week": false },
    "today": { "answered": 6, "target": 6, "score": 78, "achieved": true },
    "mastery": [
      { "lake_id": "...", "lake_name": "PCPM BI",
        "sub_topic": "Transmisi Kebijakan Moneter",
        "mastery": 0.82,            // 0..1
        "bucket": "green",          // green | yellow | red
        "due_count": 3, "lapses": 1, "accuracy_7d": 0.86 }
    ],
    "weak_spots": [ "...top N sub_topics, N=5...", "..." ],
    "hesitation": { "mastered": 42, "hesitant": 11, "impulsive": 6 },
    "activity_7d": [ { "date": "2026-08-12", "answered": 8, "accuracy": 0.75 } ]
  }

Mastery Formula
---------------

  mastery(sub_topic) = 0.6 * fsrs_factor + 0.4 * accuracy_7d

  fsrs_factor = clamp( (stability_median / 30d) * (1 - lapses*0.15), 0, 1 )
    - stability_median over the sub_topic's srs_states rows (review state
      only; new/learning treated as 0.1).
    - every lapse subtracts 15% of the base (min 0).
  accuracy_7d = correct + 0.5*partial over attempts of the last 7 days
    for questions whose flashcard sub_topic matches (empty -> 0).

  Buckets: mastery >= 0.75 green, 0.45-0.75 yellow, < 0.45 red.

Streak
------

  - Derived from drill_sessions grouped by date (local tz, Asia/Jakarta):
    achieved = answered >= target AND score >= threshold (daily-protocol.md).
  - current = consecutive achieved dates ending today or yesterday (today
    still in progress counts if achieved).
  - best = max run in history (computed by window over dates; cheap at
    personal scale).
  - grace: settings row (user_preferences JSONB under katara key) stores
    last_grace_used_at; weekly_synthesis job resets the flag weekly.

Weak Spots
----------

  - Top N (default 5) sub_topics by ascending mastery with at least one
    attempt in the last 7 days.
  - Used by: dashboard highlight, 30% new-material bias, weekly sheet input.

Weekly Weakness Synthesis Sheet
-------------------------------

  Endpoints:
    GET  /katara/synthesis/weekly   -> latest sheet for the current week
                                       (404 until generated; UI falls back
                                       to "Regenerate" button)
    POST /katara/synthesis/weekly/regenerate -> enqueue job now

  Job (weekly_synthesis, scheduled Monday 06:00 Asia/Jakarta):

    1. Load attempts of the last 7 days where is_correct=false OR
       hesitation_class IN ('hesitant','impulsive').
    2. Load referenced flashcards (content + keypoints + sub_topic).
    3. LLM (prompt `katara.synthesis`, temperature 0.3) -> JSON:

         {
           "summary_md": "## Weakness Sheet 12-18 Aug\n\n... <600 words markdown>",
           "weak_topics": ["Transmisi Kebijakan Moneter", "GWM"],
           "mistakes": [
             { "concept": "...", "common_mistake": "...", "fix": "..." }
           ]
         }

    4. Upsert weekly_sheets (user_id, week_start = Monday).
    5. Reset grace flag.

  The summary_md is rendered directly on the Progress page (read-only
  markdown with KaTeX support for formulas).

Performance Notes
-----------------

  - /progress query: attempts aggregated per user for 7 days + srs_states
    per user. At personal scale (< 50k attempts) both are index-backed and
    complete in < 50 ms; no caching in v1 (YAGNI).
  - Mastery per lake endpoint reuses the same query with lake filter.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
