# Katara Backend: Progress Tracking & Weekly Synthesis

> Progress metrics, rolling 7-day activity, sub-topic mastery matrix, and AI weekly weakness synthesis.

---

## 1. Daily Progress & Streak Tracking

- Evaluates daily questions answered from `katara_attempts` where `answered_at::DATE = CURRENT_DATE`.
- Compares against `katara_user_settings.target_questions` (default 6) and `target_score` (default 60%).
- If criteria met: `streak_count` increments.
- Grace Days: Allows 1 missed calendar day per rolling 7 days without resetting `streak_count`.

---

## 2. Sub-Topic Mastery Matrix

- Aggregates cards grouped by `(lake_id, domain, sub_topic)`.
- Calculates:
  - `mastery`: Average FSRS memory stability normalized ($0.0 - 1.0$).
  - `due_count`: Number of cards with `due_at <= NOW()`.
  - `lapses`: Sum of memory failures.
  - `accuracy_7d`: 7-day rolling correct attempt percentage.

---

## 3. Weekly Synthesis Generation (`katara_weekly_sheets`)

- Triggered on demand or via Sunday cron job.
- Gathers all attempts from the past 7 days where `is_correct = false` or `hesitation_class = 'hesitant'`.
- LLM analyzes patterns and generates markdown summary containing:
  - Identified weak conceptual domains.
  - Recurrent misconceptions and distractor trap triggers.
  - High-impact fixes and core formulas to review.
