================================================================================
  KataraGnosis Frontend Dashboard & Progress
================================================================================
  Module    : Dashboard & Progress
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Two pages: the Dashboard (daily feed, primary entry point) and the Progress
page (mastery matrix, hesitation analytics, weekly synthesis sheet).
UI copy in Bahasa Indonesia.

Dashboard (/)
-------------

  Layout (single column, generous whitespace):

  +--------------------------------------------------------------+
  | Selamat pagi, <name>   [streak: 4 hari]  [target: tercapai]  |
  |                                                              |
  |  Sesi Hari Ini                                [Mulai Sesi]   |
  |  7 review jatuh tempo + 3 kartu baru                         |
  |  Estimasi: ~12 menit                                         |
  |                                                              |
  |  Target: 6 soal · skor >= 60  (progres 5/6)  [progress bar] |
  |                                                              |
  |  Titik Lemah (3)                                              |
  |  [Transmisi Kebijakan Moneter] [GWM] [AKHLAK - Integritas]  |
  |                                                              |
  |  Penguasaan per Lake  [mastery bars: green/yellow/red dots]  |
  |  PCPM BI  ████████░░ 82%   Piano  ████░░░░░░ 41%            |
  +--------------------------------------------------------------+

  Data: GET /api/katara/today (due count, new count, progress, target
  status, weak spots, mastery light) + GET /api/katara/lakes.

  "Mulai Sesi" -> POST /api/katara/drills (default mix) ->
  router.push(/drill/<id>).
  If a session is in progress today (drill_sessions.completed_at null),
  the button says "Lanjutkan Sesi" and resumes it.

Progress (/progress)
--------------------

  Sections:

  1. Ringkasan: streak (current + best), total soal, akurasi 7 hari,
     hesitasi breakdown (3 bars)
  2. Matriks Penguasaan: table/sub-topic rows grouped by lake with
     MasteryBar (green/yellow/red), due_count, lapses, accuracy_7d;
     sort by mastery asc (weakest first); lake filter dropdown
  3. Aktivitas 7 Hari: bar chart answered/day + accuracy line
  4. Lembar Ringkasan Mingguan: latest weekly_sheets rendered as
     markdown (shared Markdown + KaTeX); empty state ->
     "Belum ada ringkasan. [Buat Sekarang]" (POST regenerate -> job
     poll -> refetch)
  5. Titik Lemah detail: weak spot rows with "Pelajari" (jump to
     library search) and "Latih" (spawn drill filtered to that
     sub_topic — POST /drills {lake_id, sub_topic filter via mix
     weights})

Shared Components (features/shared)
-----------------------------------

  MasteryBar.tsx       0-100 bar, green/yellow/red bucket styling
  StreakBadge.tsx      flame + count, gray when grace used
  ScoreRing.tsx        SVG ring for drill results + dashboard daily
  EmptyState.tsx       icon + text (Indonesian copy) + action button
  PageHeader.tsx       title + subtitle + actions
  WeeklySheetView.tsx  markdown renderer wrapper

Charts
------

  - No chart library in v1: activity bars and hesitation bars are plain
    divs with Tailwind heights (YAGNI; dependency deferred).
  - If analytics grow (P3), evaluate recharts — not before.

Polling & Refetch
-----------------

  - today/progress: staleTime 30s; invalidated by answerQuestion/finish
    mutations (state-management.md).
  - weekly sheet: staleTime 5 min; regenerate flow uses jobs polling.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
