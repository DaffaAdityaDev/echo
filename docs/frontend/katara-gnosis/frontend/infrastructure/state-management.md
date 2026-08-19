================================================================================
  KataraGnosis Frontend State Management
================================================================================
  Module    : State Management
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Two-tier state model copied from frontend/web (see
docs/frontend/web/infrastructure/state-management.md):

- React Query v5 cache = the store for all server data.
- Zustand v5 = client-only UI state, consumed with inline selectors.
- Custom hooks are the ONLY bridge between components and stores/queries.

React Query Setup
-----------------

  lib/get-query-client.ts      browser singleton (per-request client for
                               server rendering)
  lib/query-standard.ts        mandatory defaults:
                                 retry: 1, refetchOnWindowFocus: false,
                                 placeholderData: keepPreviousData
  constants/query-keys.ts      global QUERY_KEYS + per-feature factories

  Query keys:
    ["katara","lakes"]                     list
    ["katara","lakes", id]                 detail
    ["katara","sources", {lakeId,status}]  list (status filterable)
    ["katara","sources", id]               detail
    ["katara","source","chunks", id]       chunks of a source
    ["katara","flashcards", {filters}]     browse list
    ["katara","flashcards", id]            detail
    ["katara","drill", sessionId]          session
    ["katara","drill","next", sessionId]   current question
    ["katara","drill","results", sessionId]
    ["katara","today"]                     daily feed summary
    ["katara","progress"]                  mastery matrix
    ["katara","synthesis","weekly"]        weekly sheet
    ["katara","jobs", id]                  job poll
    ["auth","me"]

  Stale times (per domain staleTime table):
    lakes/progress/today       30s
    sources lists             15s
    jobs poll                 3s  (active polling while status=processing)
    drill question            Infinity (served question is frozen)
    drill results             Infinity (until session complete)

Polling for Upload
------------------

  useUploadSource hook (features/library):
    - mutation POST /api/katara/sources
    - on success: poll ["katara","jobs", id] with refetchInterval 3s while
      status != done/failed; stop on terminal; invalidate sources lists.

Zustand Stores
--------------

+-------------------------+--------------------------------------------------+
| Store                   | State                                            |
+-------------------------+--------------------------------------------------+
| authStore               | user, setUser, clearAuth                          |
| drillStore              | activeSession, currentQuestion, timerStartAt,     |
|                         | answerQueue (per-question), results               |
| settingsStore           | session size, target, thresholds, grace, lake     |
|                         | weights (persisted localStorage + server sync)    |
+-------------------------+--------------------------------------------------+

  - Inline selectors only: useDrillStore((s) => s.currentQuestion).
  - No wrapper-hook boilerplate (logic-layering.md rule).
  - drillStore is transient: the URL holds sessionId; on refresh the drill
    page rehydrates from ["katara","drill", id] + next endpoint (answered
    guard prevents double-answers).

Mutation Invalidation Map
-------------------------

  +----------------------------------------+--------------------------------+
  | Mutation                               | Invalidate                     |
  +----------------------------------------+--------------------------------+
  | createLake / updateLake / deleteLake   | lakes lists, today, progress   |
  | uploadSource                           | sources lists, jobs            |
  | deleteSource / reprocessSource         | sources, chunks, jobs, today   |
  | saveManualFlashcard / updateFlashcard  | flashcards, source chunks      |
  | startDrill                             | today, progress                |
  | answerQuestion                         | drill session, next, progress  |
  | finishDrill                            | today, progress, results       |
  | regenerateWeeklySheet                  | synthesis weekly, jobs         |
  +----------------------------------------+--------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
