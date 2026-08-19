================================================================================
  KataraGnosis Tailwind v4 Setup
================================================================================
  Module    : Tailwind
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Tailwind v4, CSS-first configuration (no tailwind.config.js) — identical
to frontend/web. PostCSS plugin @tailwindcss/postcss only.

Files
-----

  postcss.config.mjs
    export default { plugins: { "@tailwindcss/postcss": {} } };

  src/app/globals.css
    @import "tailwindcss";
    @plugin "@tailwindcss/typography";
    @custom-variant dark (&:where(.dark, .dark *));

    @theme inline {
      --color-bg-base: #0B0F17;
      --color-bg-panel: #111827;
      --color-bg-raised: #1B2434;
      --color-border: #263040;
      --color-border-hi: #33415C;
      --color-fg: #E6EAF2;
      --color-fg-muted: #8B96A8;
      --color-fg-faint: #5B6678;
      --color-primary: #6366F1;
      --color-primary-hi: #818CF8;
      --color-primary-deep: #4338CA;
      --color-success: #34D399;
      --color-warn: #FBBF24;
      --color-danger: #F87171;
      --color-accent: #F59E0B;
      --font-sans: var(--font-inter);
      --font-mono: var(--font-jetbrains-mono);
      --radius-card: 12px;
      --radius-control: 8px;
    }

  Dark mode is the DEFAULT theme (single theme in v1; dark: variant
  reserved for future light mode).

Base Layer
----------

  @layer base {
    body { @apply bg-base text-fg font-sans antialiased; }
    ::selection { background: color-mix(in srgb, var(--color-primary) 30%, transparent); }
  }

Utilities & Helpers (custom)
----------------------------

  .focus-ring       2px primary/50 ring on focus-visible
  .card             bg-panel border border-border rounded-card
  .chip             rounded-full bg-raised border border-border px-2 py-0.5
                    text-caption
  .mono-num         font-mono tabular-nums
  .scrim            bg-black/60
  .scrollbar-thin   thin styled scrollbars (webkit + firefox)

Typographic Plugin
------------------

  @tailwindcss/typography (prose) used for:
    - flashcard content reading view
    - weekly synthesis sheet markdown
  prose overrides: --tw-prose-invert on dark bg; code styled with
  font-mono + bg-raised.

Fonts
-----

  next/font/google:
    Inter (variable, subsets: latin, display swap)
    JetBrains Mono (variable, subsets: latin, display swap)
  Declared in src/app/layout.tsx and bound to --font-inter /
  --font-jetbrains-mono.

Checks
------

  - All colors referenced in code must come from the token theme —
    no arbitrary hex literals in JSX (biome rule enforced by review).
  - npm run build validates CSS; purge is automatic (v4).

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
