# KataraGnosis: 20-Minute Daily Learning Protocol

> Core workflow and spaced retrieval schedule designed for high-stakes test preparation and knowledge retention.

---

## 1. Protocol Philosophy

The 20-Minute Daily Protocol leverages the **FSRS (Free Spaced Repetition Scheduler)** algorithm combined with **Active Recall** and **Latency-Aware Evaluation**.

```
┌────────────────────────────────────────────────────────┐
│             20-Minute Daily Practice Block             │
│                                                        │
│  [1. Warm-up Review] ──────────────▶ 70% Due Cards     │
│  - Scheduled FSRS items                              │
│  - Hesitation & latency tracking                       │
│                                                        │
│  [2. New Material Injection] ──────▶ 30% New Cards     │
│  - Newly ingested flashcards                           │
│  - Foundation conceptual units                         │
│                                                        │
│  [3. Weekly Synthesis & Weak Spot Loop]                │
│  - AI-generated summary sheet                          │
│  - Targeted remedial drills                            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Daily Session Structure

1. **Target Criteria**:
   - Minimum **6 questions** answered per day with a cumulative score $\ge$ **60%**.
   - Preserves user streak (`streak_count`).
   - 1 grace day permitted per rolling 7-day window without streak breakage.

2. **Session Mix**:
   - Default session size: **10 questions**.
   - Composition: **7 reviews** (FSRS `due_at <= NOW()`) + **3 new cards** (`state = 'new'`).

3. **Hesitation Scoring**:
   - Response latency is recorded from question display to answer submission.
   - Classification:
     - **Mastered** ($\le 30\text{s}$, correct): Retention verified. Stability increased.
     - **Hesitant** ($> 30\text{s}$, correct): Weak recall. Shorter next interval scheduled.
     - **Impulsive** ($< 5\text{s}$, incorrect): Overconfidence trap triggered. Tagged for weekly remediation.

---

## 3. Database State Flow (`katara_db`)

```
katara_flashcards (domain, sub_topic, archetype, keypoints)
       │
       ▼
katara_srs_states (stability, difficulty, reps, lapses, due_at)
       │
       ▼ [Serve Daily Drill Session]
katara_questions ──▶ katara_attempts (latency_ms, hesitation_class)
       │
       ▼ [Weekly Invalidation & Aggregation]
katara_weekly_sheets (summary_md, weak_topics, mistakes)
```
