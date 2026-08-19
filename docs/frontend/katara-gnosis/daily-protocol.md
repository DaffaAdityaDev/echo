================================================================================
  KataraGnosis Daily Practice Protocol
================================================================================
  Module    : Daily Protocol
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The daily protocol is the behavioral contract between the app and the user.
It exists to maximize retention and critical thinking while making a 10-15
minute session per day sustainable forever. It deliberately removes decision
fatigue: the user never chooses what to study — the Smart Feed decides.

Design Principles
-----------------

+---------------------------+------------------------------------------------+
| Principle                 | Implementation                                 |
+---------------------------+------------------------------------------------+
| Minimum viable day        | Daily floor is a single 10-15 min session.     |
| Zero decision fatigue     | One button: "Start Today's Session".           |
| No organization burden    | AI clusters everything at ingestion time.      |
| No guilt mechanics        | No catch-up debt; missed items return via SRS. |
| Immediate reward          | Streak, score, and mastery bars update live.   |
| Fatigue awareness         | Latency classes detect hesitation, not just    |
|                           | right/wrong.                                   |
+---------------------------+------------------------------------------------+

Smart Feed (70/30 Mix)
----------------------

When a drill session is created, the backend builds the mix:

+-----------+-------------------+----------------------------------------------+
| Portion   | Source            | Selection rule                               |
+-----------+-------------------+----------------------------------------------+
| 70%       | Due reviews       | Flashcards whose FSRS `due_at <= now`; pick   |
|           |                   | by earliest due date first.                   |
| 30%       | New material      | Flashcards never drilled before; pick by      |
|           |                   | lake weights and weakest sub_topic first.     |
+-----------+-------------------+----------------------------------------------+

Mix rules:

- If due reviews are fewer than 70% of the target size, new material fills
  the gap (never under-fill a session).
- If there is no new material, the session is 100% reviews.
- Session size defaults to 10 questions; configurable in Settings (min 5,
  max 25).
- A "Daily Drill Mix" can be filtered by lake (e.g., 6 piano + 4 monetary
  policy) or combined across lakes; combined is the default.

Session Flow
------------

  1. Start session (POST /drills)              -> mix is computed and frozen
  2. For each question:
       a. GET /drills/:id/next                 -> question + timer starts
       b. User answers
       c. POST /drills/:id/answer              -> evaluation + feedback +
                                                 FSRS update + latency class
  3. Finish -> results screen (score, accuracy, weak spots hit)

Scoring
-------

### Session score (0-100)

  score = round( 100 * accuracy * difficulty_weight )

  difficulty_weight = average weight of answered questions:
    easy=1.0, medium=1.1, hard=1.25
  accuracy  = correct / answered

Open-ended (short_answer/scenario) answers are graded 1-5 by the LLM; a grade
>= 4 counts as correct, 2-3 counts as "partial" (0.5), 1 counts as wrong.

### Target achieved (daily goal)

A day counts as achieved when BOTH hold:

  - answered >= 6 questions, AND
  - session score >= 60

Achieving the target increments the streak by 1.

### Streak and grace

  - Streak = consecutive achieved days.
  - Grace day: once per week the streak survives a missed/unachieved day
    (tracked by the frontend Settings; backend stores streak_days and
    last_grace_used_at on the user's katara profile).
  - No catch-up: missed reviews simply remain due and re-enter the feed.

Latency Classification (hesitation metric)
------------------------------------------

The backend measures answer latency (ms) and combines it with correctness:

+----------------+------------------+-------------------------------------------+
| Latency        | Result           | Class (attempts.hesitation_class)         |
+----------------+------------------+-------------------------------------------+
| <= 30 s        | correct          | mastered  -> FSRS interval extended       |
| 30-60 s        | correct          | hesitant  -> review scheduled sooner      |
| <= 30 s        | wrong            | impulsive -> needs reasoning drill        |
| > 60 s         | any              | hesitant  -> concept not solidified       |
+----------------+------------------+-------------------------------------------+

The class drives the FSRS update (see backend/application/features/drills.md)
and feeds the progress dashboard's hesitation histogram.

Anti-Fatigue Rules
------------------

+-----------------------------+----------------------------------------------+
| Rule                        | Rationale                                    |
+-----------------------------+----------------------------------------------+
| Fixed small timebox         | Session capped at ~15 min; no endless mode.  |
| No catch-up backlog UI      | The feed only shows today's queue.           |
| Grace day                   | Life happens; streak survives once/week.     |
| Weekly synthesis, not       | Missed concepts come back as a 1-page        |
| backlog guilt               | summary + SRS, not as an inbox.              |
| Immediate explanation       | Every answer shows explanation + distractor  |
|                             | breakdown so the session teaches.            |
+-----------------------------+----------------------------------------------+

Progression Metrics
-------------------

### Mastery (per sub_topic)

  mastery(sub_topic) = 0..1 blend of:
    - FSRS state (stability, lapses, due-ness)    weight 0.6
    - 7-day rolling accuracy                      weight 0.4

  UI buckets: >= 0.75 green (Mastered), 0.45-0.75 yellow (Review Due),
  < 0.45 red (Weak Spot).

### Weak spots

  - The N sub_topics with the lowest mastery and at least one attempt in the
    last 7 days.
  - Weak spots get priority in the 30% new-material selection and are
    highlighted on the dashboard.

### Weekly Weakness Synthesis Sheet

  - Asynq job `weekly_synthesis` runs Monday 06:00 (configurable).
  - Input: all wrong/hesitant attempts from the last 7 days + the flashcards
    they reference.
  - Output: a single dense page (max 600 words) listing the concepts most
    often missed, common mistakes, and the formulas/theories misapplied.
  - Stored as a JSONB document in `srs_states`-adjacent table `weekly_sheets`
    (see domain/models.md) and rendered on the Progress page.

Example Daily Timeline
----------------------

  08:00  Dashboard shows: "12 menit hari ini - 7 review, 3 baru" [Start]
  08:01  Drill runs 10 questions with instant feedback + explanations
  08:14  Results: score 78, target achieved, streak 4, 2 weak spots hit
  08:15  One-tap "Baca Weak Spot" opens the related flashcards
         Done. Total ~14 minutes.

Configuration Surface (Settings page)
-------------------------------------

+--------------------------+-----------------------------------------------+
| Setting                  | Default                                       |
+--------------------------+-----------------------------------------------+
| Session size             | 10 questions                                  |
| Daily target questions   | 6                                             |
| Target score threshold   | 60                                            |
| Grace days per week      | 1                                             |
| Lake mix weights         | equal                                         |
| Weekly sheet time        | Monday 06:00                                  |
+--------------------------+-----------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
