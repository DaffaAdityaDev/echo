# Katara Backend: Adaptive Practice & Drills

> FSRS-driven session composition, real-time question generation, latency tracking, and evaluation.

---

## 1. Daily Session Composition Algorithm

When `POST /api/v1/katara/drills` is called:

1. Calculates review ratio: default 70% due review items + 30% new unlearned items.
2. Selects due cards from `katara_srs_states` where `due_at <= NOW()` sorted by urgency ($\frac{\text{elapsed\_days}}{\text{scheduled\_days}}$).
3. Selects new cards from `katara_flashcards` where `srs.state = 'new'` or `srs_state` is uninitialized.
4. If due review count is insufficient, fills remainder with new cards or weakest mastered cards.

---

## 2. Dynamic Question Generation

For each card served during the drill:

1. If question type is `mcq`:
   - LLM generates 1 correct option + 3 distractor trap options.
   - Distractor traps are labeled (`false_causation`, `extreme_generalization`, `partial_truth`, `out_of_scope`).
2. If question type is `true_false`:
   - LLM formats proposition with subtle nuance to test true comprehension.
3. If question type is `short_answer` or `scenario`:
   - Evaluated by LLM with rubric score (1 to 5) and explanation of missing key principles.

---

## 3. Latency & Hesitation Scoring

- Latency is measured from question dispatch to answer submission.
- Value is clamped to $[0, 1800000]\text{ ms}$ (0 to 30 min).
- Hesitation classification:
  - **Mastered**: Correct and latency $\le 30\text{s}$.
  - **Hesitant**: Correct and latency $> 30\text{s}$.
  - **Impulsive**: Incorrect and latency $< 5\text{s}$.
- FSRS memory stability updates:
  - Mastered: Full interval expansion.
  - Hesitant: Reduced interval expansion.
  - Impulsive / Incorrect: Reps reset to learning state (`lapses++`).
