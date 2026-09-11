# Katara Backend: AI Call & Prompt Engineering Pattern

> Self-contained LLM invocation, prompt constants, and JSON response schema enforcement.

---

## 1. Zero Dependency on Echo Prompt Templates

Prompt templates for KataraGnosis are defined directly as Go string constants in `app/KataraGnosis/backend/internal/constants/prompts.go`. Katara does not query or depend on Echo's `prompt_versions` or LLMOps studio.

---

## 2. Core Prompt Definitions

1. **Extraction Prompt (`PromptIngestFlashcards`)**:
   - Parses raw document blocks into atomic 300-500 token cards.
   - Enforces valid JSON array output with fields: `content`, `domain`, `sub_topic`, `archetype`, `keypoints`.

2. **Question Generation Prompt (`PromptGenerateDrillQuestion`)**:
   - Converts a flashcard unit into an adaptive test question (MCQ, True/False, Short Answer, Scenario).
   - Generates distractor trap classifications for incorrect options.

3. **Subjective Evaluation Prompt (`PromptEvaluateAnswer`)**:
   - Evaluates short answer / scenario responses against key principles.
   - Returns rubric grade ($1 - 5$), actionable feedback, and identified misconception.

4. **Weekly Synthesis Prompt (`PromptWeeklySynthesis`)**:
   - Summarizes 7-day error patterns into structured markdown and key takeaway items.
