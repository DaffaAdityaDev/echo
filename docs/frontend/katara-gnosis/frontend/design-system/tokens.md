================================================================================
  KataraGnosis Design Tokens
================================================================================
  Module    : Design Tokens
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

KataraGnosis has its own visual identity, distinct from the ECHO blueprint
aesthetic: a calm, focused "study desk" look. Dark UI with deep slate
backgrounds, indigo primary, emerald success, amber streak accent, and
semantic mastery colors. Typography: Inter for UI, JetBrains Mono for
numbers/code.

Tokens live in src/app/globals.css under @theme inline (Tailwind v4)
mapped to utilities (bg-*, text-*, border-*) exactly like frontend/web
tokens.md.

Color Tokens
------------

+------------------+----------+---------------+------------------------------+
| Token            | Value    | Utility       | Usage                        |
+------------------+----------+---------------+------------------------------+
| --color-bg-base  | #0B0F17  | bg-base       | App background               |
| --color-bg-panel | #111827  | bg-panel      | Cards, sidebar, modals       |
| --color-bg-raised| #1B2434  | bg-raised     | Inputs, hover states         |
| --color-border   | #263040  | border        | Default borders              |
| --color-border-hi| #33415C  | border-hi     | Focus rings, dividers        |
| --color-fg       | #E6EAF2  | text-fg       | Primary text                 |
| --color-fg-muted | #8B96A8  | text-fg-muted | Secondary text               |
| --color-fg-faint | #5B6678  | text-fg-faint | Placeholders, disabled       |
| --color-primary  | #6366F1  | bg-primary    | Indigo: CTAs, active nav     |
| --color-primary-hi| #818CF8  |              | Hover                        |
| --color-primary-deep| #4338CA|              | Pressed                      |
| --color-success  | #34D399  | text-success  | Correct, Mastered (green)    |
| --color-warn     | #FBBF24  | text-warn     | Review due (yellow), streak  |
| --color-danger   | #F87171  | text-danger   | Wrong, Weak (red)            |
| --color-accent   | #F59E0B  | text-accent   | Streak flame, focus sparkle  |
+------------------+----------+---------------+------------------------------+

Mastery buckets map directly: green=success, yellow=warn, red=danger.

Typography
----------

+--------------------+------------------------+-----------------------------+
| Token              | Value                  | Usage                       |
+--------------------+------------------------+-----------------------------+
| --font-sans        | Inter (next/font)      | UI text                     |
| --font-mono        | JetBrains Mono         | Scores, timers, numbers,    |
|                    | (next/font)            | code blocks                 |
| Base size          | 16px                   |                             |
| Display            | 2rem/700/tight         | Page titles                 |
| Title              | 1.25rem/600            | Card headers                |
| Body               | 0.9375rem/400          | Default text                |
| Caption            | 0.8125rem/400 muted    | Metadata, labels            |
| Numeric           | font-mono tabular-nums | Timers, scores, mastery %   |
+--------------------+------------------------+-----------------------------+

Spacing & Radius
----------------

+---------------------+--------+--------------------------------------------+
| Token               | Value  | Usage                                      |
+---------------------+--------+--------------------------------------------+
| Space 1-8           | 4-32px | Standard 4px scale (Tailwind default)      |
| Radius card         | 12px   | Cards, panels, modals                      |
| Radius control      | 8px    | Buttons, inputs, badges                    |
| Radius chip         | 999px  | Tags, mastery dots, streak badge           |
+---------------------+--------+--------------------------------------------+

Elevation
---------

  - Cards: border 1px border + bg-panel (no heavy shadows; subtle
    shadow-lg with black/40 at 8% for modals only).
  - Focus: 2px ring primary/50.
  - Overlay scrim: black/60.

Motion
------

  - 150ms ease-out transitions on buttons/badges; 250ms for panels.
  - Respect prefers-reduced-motion (global kill-switch like frontend/web).
  - Micro-interactions only: progress bar fill, score ring sweep,
    streak flame pop.

Iconography
-----------

  - lucide-react (already in repo stack).
  - Semantic icon map: lake (Boxes), source pdf (FileText), source md
    (FileCode), flashcard (Layers), drill (Target), streak (Flame),
    weak spot (AlertTriangle), search (Search), check (CheckCircle2).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
