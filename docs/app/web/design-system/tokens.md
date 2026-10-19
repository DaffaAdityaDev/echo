===============================================================================
  Design Tokens — Implemented Semantic Tokens
===============================================================================
  Module    : Design Tokens
  Service   : Web
  Version   : 2.0.0
  Updated   : 2026-10-16
===============================================================================

## Description

The Guardbase palette is implemented as CSS custom properties in
`app/web/src/app/globals.css` and exposed to Tailwind v4 through
`@theme inline`. Components use **semantic** utility classes
(`bg-surface`, `text-muted`, `border-border`, `text-accent`, ...) instead of
raw palette classes (`bg-zinc-100`, `text-purple-600`, ...). Every semantic
token has a light and a dark value, so components never need `dark:`
overrides for colour.

This file is the source of truth. When a token changes, update
`globals.css` and this document together.

## 1. Theme Application

- Dark mode follows the OS setting via `@media (prefers-color-scheme: dark)`.
  The variables on `:root` are redefined inside that media query, so there is
  no client script and no hydration flash.
- The Tailwind `dark:` variant is bound to the same media query
  (`@custom-variant dark (@media (prefers-color-scheme: dark))`). Use it only
  when a semantic token cannot express the difference.
- `:root` sets `color-scheme` (light / dark) so native controls (scrollbars,
  `<select>`, date pickers) match the theme. The root layout also exports
  `viewport.colorScheme = "light dark"` and a per-scheme `themeColor`.
- There is no in-app theme override today. Adding one means applying a class
  or `data-theme` attribute on `<html>` before paint (inline script in the
  root layout) and extending the `dark` custom variant to match it.

## 2. Colour Tokens

Utility name = `<property>-<token>`, e.g. `bg-surface`, `text-muted`,
`border-border-strong`, `ring-accent`. Opacity modifiers work on every token
(`bg-danger/10`, `border-accent/30`).

### A. Surfaces

| Token           | CSS variable           | Light     | Dark                | Usage                                         |
|-----------------|------------------------|-----------|---------------------|-----------------------------------------------|
| `background`    | `--echo-bg`            | `#ffffff` | `#09090b`           | Page canvas                                   |
| `surface`       | `--echo-surface`       | `#fafafa` | `#111113`           | Sidebar, subtle panels, input fills           |
| `surface-hover` | `--echo-surface-hover` | `#f1f5f9` | `#1c1c20`           | Hover/active rows, chips, skeletons           |
| `elevated`      | `--echo-elevated`      | `#ffffff` | `#18181b`           | Cards, dialogs, menus, toasts, message bubbles|
| `overlay`       | `--echo-overlay`       | `rgba(9,9,11,.55)` | `rgba(0,0,0,.7)` | Modal / drawer backdrop                 |

### B. Text

| Token        | CSS variable        | Light     | Dark      | Usage                                            |
|--------------|---------------------|-----------|-----------|--------------------------------------------------|
| `foreground` | `--echo-foreground` | `#09090b` | `#fafafa` | Primary text, headings                           |
| `muted`      | `--echo-muted`      | `#475569` | `#a1a1aa` | Secondary text, labels, meta (AA on every surface in both themes)|
| `subtle`     | `--echo-subtle`     | `#64748b` | `#8b8b94` | Placeholders, decorative icons only — not body text |

### C. Lines

| Token           | CSS variable           | Light     | Dark      | Usage                               |
|-----------------|------------------------|-----------|-----------|-------------------------------------|
| `border`        | `--echo-border`        | `#e2e8f0` | `#27272a` | Default 1px borders and dividers    |
| `border-strong` | `--echo-border-strong` | `#cbd5e1` | `#3f3f46` | Emphasised outlines, dashed rules   |

### D. Brand (Guardbase blue)

| Token                | CSS variable                | Light     | Dark                   | Usage                                     |
|----------------------|-----------------------------|-----------|------------------------|-------------------------------------------|
| `accent`             | `--echo-accent`             | `#2563eb` | `#60a5fa`              | Links, active text/icons, focus rings, accent borders |
| `accent-hover`       | `--echo-accent-hover`       | `#1d4ed8` | `#93c5fd`              | Hover state of accent text                |
| `accent-soft`        | `--echo-accent-soft`        | `#eff6ff` | `rgba(59,130,246,.14)` | Tinted background behind accent content   |
| `primary`            | `--echo-primary`            | `#2563eb` | `#2563eb`              | Solid fills (primary buttons, selected chips) |
| `primary-hover`      | `--echo-primary-hover`      | `#1d4ed8` | `#1d4ed8`              | Hover of solid fills                      |
| `primary-foreground` | `--echo-primary-foreground` | `#ffffff` | `#ffffff`              | Text/icons on `primary`                   |

`accent` is for foreground use and lightens in dark mode for contrast;
`primary` is for fills and stays saturated so white text keeps AA contrast.
Purple/violet/indigo/teal are not part of the palette.

Text on a solid fill: `text-primary-foreground` on `bg-primary`;
`text-background` on `bg-success` / `bg-danger` (those fills lighten in dark
mode, so white text would lose contrast).

### E. Status

| Token     | Light     | Dark      | Usage                                      |
|-----------|-----------|-----------|--------------------------------------------|
| `success` | `#059669` | `#34d399` | Completed, verified, approved              |
| `warning` | `#d97706` | `#fbbf24` | Looping, stalled, large-payload notices    |
| `danger`  | `#dc2626` | `#f87171` | Errors, destructive actions, degraded mode |

Status backgrounds use opacity modifiers: `bg-danger/10 border-danger/30
text-danger`.

### F. Theme-independent constants

| Token               | Value     | Usage                                         |
|---------------------|-----------|-----------------------------------------------|
| `status-blocked`    | `#f43f5e` | Prompt injection, critical alert (Guardbase)  |
| `status-verified`   | `#10b981` | Safe prompt verified                          |
| `status-parameter`  | `#22d3ee` | MCP parameter hijack warning                  |
| `gb-blue`           | `#2563eb` | Brand constant (legacy; prefer `primary`)     |
| `gb-bright-blue`    | `#3b82f6` | Brand constant (legacy; unused by components)  |
| `gb-dark-blue`      | `#1d4ed8` | Brand constant (legacy; prefer `primary-hover`)|
| `gb-light-blue`     | `#60a5fa` | Brand constant                                |
| `gb-periwinkle`     | `#93c5fd` | Brand constant                                |

### G. Code surfaces (theme-independent)

Syntax-highlighted blocks (`CodeBlock`, `lib/echo-code-theme.ts`) and raw
JSON / prompt panes (debug drawer, prompt studio, docs base URL) stay dark in
both themes. Use these instead of `bg-zinc-900` / `text-zinc-100`.

| Token             | Value     | Usage                                    |
|-------------------|-----------|------------------------------------------|
| `code`            | `#0d1117` | Code / JSON pane background (`bg-code`)  |
| `code-header`     | `#161b22` | Code block header bar, copy button fill  |
| `code-foreground` | `#e6edf3` | Text on code panes                       |
| `code-muted`      | `#8b949e` | Language label, secondary text on panes  |
| `code-border`     | `#30363d` | Pane borders and dividers                |

### H. Decorative

| CSS variable          | Light                     | Dark                      | Usage                       |
|-----------------------|---------------------------|---------------------------|-----------------------------|
| `--echo-grid-line`    | `rgba(100,116,139,.12)`   | `rgba(148,163,184,.06)`   | `.bg-grid-tech` lines       |
| `--echo-crosshair`    | `#94a3b8`                 | `#52525b`                 | `.crosshair-container` `+`  |

## 3. Typography

Font: IBM Plex Mono everywhere (`font-sans`, `font-display`, `font-mono`
all resolve to it).

| Class       | Size  | Usage                                                         |
|-------------|-------|---------------------------------------------------------------|
| `text-2xs`  | 11px  | Tiny meta only: eyebrows, badges, counters, timestamps, button labels (uppercase, tracked) |
| `text-xs`   | 12px  | **Floor for UI text**: controls, list rows, descriptions, errors |
| `text-sm`   | 14px  | Body copy, chat messages                                      |
| `text-base` | 16px  | Dialog titles, card titles                                    |
| `text-lg`+  | 18px+ | Page and hero headings                                        |

Arbitrary sizes below 11px (`text-[8px]`, `text-[9px]`, `text-[10px]`) are
not allowed.

| Tracking token          | Value     | Class                    |
|-------------------------|-----------|--------------------------|
| hero                    | -0.045em  | `tracking-hero`          |
| section                 | -0.035em  | `tracking-section`       |
| button (tech mono)      | 0.06em    | `tracking-tech-mono`     |
| eyebrow                 | 0.10em    | `tracking-eyebrow`       |

## 4. Radius

| Class                              | Value | Usage                                         |
|------------------------------------|-------|-----------------------------------------------|
| `rounded-xs` / `rounded-sm`        | 2px   | Controls: buttons, inputs, chips, badges, rows|
| `rounded-md`                       | 6px   | Cards, panels, dialogs, menus, toasts         |
| `rounded-lg` … `rounded-3xl`       | 6px   | Legacy aliases collapsed onto `md`            |
| `rounded-full`                     | pill  | Avatars, status dots, progress tracks         |

## 5. Focus & Motion

- Global `:focus-visible` outline: 2px `accent`, 2px offset. Components may
  replace it with `focus-visible:ring-*` using `accent`.
- Easing: `--echo-ease` = `cubic-bezier(0.16, 1, 0.3, 1)`.
- Entrance utilities: `animate-in` + one of `fade-in`, `zoom-in-95`,
  `slide-in-from-bottom-1`, `slide-in-from-bottom-2`, `slide-in-from-left-2`,
  `slide-in-from-right`.
- `prefers-reduced-motion: reduce` disables animations and transitions
  globally; the streaming token scramble in `Markdown.tsx` is skipped too.

## 6. Prose

`.prose` colour variables (`--tw-prose-*`) map to the semantic tokens, so
Markdown content follows the theme without `prose-invert`.

## Source References

| File                                          | Description                         |
|-----------------------------------------------|-------------------------------------|
| `app/web/src/app/globals.css`                 | Token definitions (light + dark)    |
| `app/web/src/app/layout.tsx`                  | `viewport` colour scheme/theme colour |
| `app/web/src/components/ui/*`                 | Primitives built on the tokens      |
| `docs/app/web/design-system/README.md`        | Design philosophy                   |
| `docs/app/web/design-system/components.md`    | Component blueprints                |

===============================================================================
  © 2026 Echo — All Rights Reserved
===============================================================================
