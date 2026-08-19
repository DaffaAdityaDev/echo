================================================================================
  KataraGnosis UI Components
================================================================================
  Module    : Components
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Hand-rolled UI kit in src/components/ui/ (same approach as frontend/web:
no shadcn/radix). All components are dark-first, use design tokens from
tokens.md, and are typed with strict TS.

Primitives (components/ui/)
---------------------------

+----------------+---------------------------------------------------------+
| Component      | API / Notes                                            |
+----------------+---------------------------------------------------------+
| Button         | variants: primary, secondary, ghost, danger, link;     |
|                | sizes sm/md/lg; loading spinner; icon slot;            |
|                | uppercase 0.06em letter-spacing on md+ (echo style)    |
| Input          | text/email/password + label + error message +          |
|                | hint slot                                              |
| Textarea       | auto-resize optional, char counter (drill answers)     |
| Select         | styled native select (lakes, archetype, filters)       |
| Modal          | focus trap, Esc close, scrim, header/footer slots      |
| Tabs           | underline tabs, keyboard arrows, aria role=tab         |
| Badge          | tone: neutral/success/warn/danger/primary; size sm/md  |
| ProgressBar    | value 0-100, tone by bucket (green/yellow/red)         |
| Spinner        | svg ring, size sm/md/lg                                |
| Tooltip        | hover + focus, aria-describedby                        |
| Toast          | ToastProvider + useToast (copied pattern)              |
| EmptyState     | icon, title, description, action slot                  |
| Skeleton       | pulse blocks for loading states                        |
| ConfirmDialog  | destructive confirm wrapper around Modal               |
| Kbd            | keyboard shortcut chip (Ctrl+Enter, /)                 |
+----------------+---------------------------------------------------------+

Domain Components (features/shared/components/)
-----------------------------------------------

  MasteryBar        progress + bucket label (Penguasaan x%)
  StreakBadge       flame icon + count; dimmed when grace used
  ScoreRing         SVG ring, mono font number
  SourceTypeIcon    pdf/md/txt icon + color
  StatusBadge       Uploaded/Processing/Ready/Failed (Indonesian copy:
                    "Diproses" etc. as labels, code enum in English)
  QuestionCard      shared card frame for drill + library preview
  WeeklySheetView   markdown + KaTeX renderer (shared Markdown)

Conventions
-----------

  - cn() = twMerge(clsx(...)) from src/utils/cn.ts (copy).
  - All components accept className via cn merge.
  - Accessibility: aria-labels on icon-only buttons, visible focus
    rings, contrast >= 4.5:1 (checked against tokens), keyboard
    navigable menus/dialogs.
  - No motion library (framer-motion NOT included; CSS transitions only).
  - Components are presentational: no data fetching, no stores.

Form Patterns
-------------

  - Upload: UploadZone component (drag over state, file validation,
    progress callback) -> uses toast + job poll (library.md).
  - Flashcard metadata form: fields + inline list editor for keypoints
    (add/remove/order).
  - Settings: grouped cards with labeled inputs + "Simpan" button +
    saved toast.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
