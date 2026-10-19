================================================================================
  UI Components
================================================================================
  Module    : UI Components
  Service   : Web
  Version   : 2.0
  Updated   : 2026-10-16 (semantic tokens, a11y contracts, DropdownMenu, Switch, Modal slots)
================================================================================

## Deskripsi

Reusable primitives in `src/components/ui/`. Each one uses `cn()` (clsx +
tailwind-merge) for className merging and styles itself only with the
semantic tokens from `docs/app/web/design-system/tokens.md` (`bg-elevated`,
`text-muted`, `border-border`, `text-accent`, `bg-danger/10`, ...). Raw
palette classes (`zinc-*`, `purple-*`, ...) and `dark:` colour overrides are
not used inside primitives; the tokens already switch with the theme.

## File Structure

```
src/components/ui/
├── Badge.tsx
├── Button.tsx
├── CopyButton.tsx
├── DropdownMenu.tsx
├── Input.tsx
├── Kbd.tsx
├── Modal.tsx
├── ProgressBar.tsx
├── StatCard.tsx
├── Switch.tsx
├── Tabs.tsx
└── Toast.tsx
```

## Components

### Button

| Prop      | Type                                                          | Default   |
|-----------|---------------------------------------------------------------|-----------|
| variant   | `primary` / `secondary` / `ghost` / `danger` / `outline`      | `primary` |
| size      | `sm` / `md` / `lg`                                            | `md`      |
| isLoading | boolean: shows a spinner, sets `disabled` and `aria-busy`     | `false`   |

- `primary`: Guardbase gradient (`gb-bright-blue` to `primary`), white text.
- `secondary`: `bg-elevated border-border`; `ghost`: transparent, `text-muted`.
- `danger`: `bg-danger/10 text-danger border-danger/30`, solid on hover.
- `outline`: bordered, accent on hover.
- All sizes use `rounded-sm`; `sm`/`md` labels are `text-2xs` uppercase
  (`tracking-tech-mono`), `lg` is `text-xs`.
- `isLoading` always wins over a caller-supplied `disabled={false}`.

### Input

`h-9 rounded-sm border-border bg-elevated text-xs`, accent focus ring.
Set `aria-invalid` to get the danger border; pair it with
`aria-describedby` pointing at the error message.

### Badge

Variants: `default`, `outline`, `success`/`verified`, `warning`, `danger`,
`blocked`, `parameter`. All are `text-2xs` uppercase with a 1px border in the
variant colour at 30% opacity.

### Modal

Controlled dialog (`"use client"`).

| Prop          | Type       | Description                                                         |
|---------------|------------|---------------------------------------------------------------------|
| isOpen        | boolean    | Controls visibility                                                 |
| onClose       | () => void | Close callback (read through a ref; may change every render)        |
| title         | string     | Heading, wired to `aria-labelledby`                                 |
| description   | string     | Subtitle, wired to `aria-describedby`                               |
| className     | string     | Panel classes (e.g. `max-w-2xl max-h-[85vh]`)                       |
| bodyClassName | string     | Body classes (e.g. `flex-1 flex flex-col overflow-hidden` for a scrolling list) |
| headerActions | ReactNode  | Extra header controls rendered before the close button (e.g. Settings "Reset") |
| footer        | ReactNode  | Action row pinned below the body (Cancel / Confirm)                 |
| children      | ReactNode  | Optional body; omit it for a confirm dialog whose text is the `description` |

Behaviour: `role="dialog"` + `aria-modal`, focus moves into the panel and is
trapped on Tab, Escape and backdrop click close, focus returns to the opener,
body scroll is locked. Every overlay dialog (settings, model selector, HITL
approval, help, prompt promote/rollback confirmation) MUST use this primitive
instead of a hand-rolled overlay.

### DropdownMenu

Icon-trigger menu used to collapse secondary actions (e.g. the chat header
below the `sm` breakpoint).

| Prop             | Type                               | Description                              |
|------------------|------------------------------------|------------------------------------------|
| label            | string                             | Accessible name of the trigger and menu  |
| icon             | LucideIcon                         | Trigger icon                             |
| items            | `{ id, label, icon?, onSelect }[]` | Menu entries                             |
| triggerClassName | string                             | Trigger styling                          |

Behaviour: `aria-haspopup="menu"` / `aria-expanded`, items are
`role="menuitem"`, first item focused on open, ArrowUp/ArrowDown cycle,
Escape closes and restores focus to the trigger, outside pointer-down and Tab
close it.

### Tabs

`role="tablist"` with `role="tab"` buttons, `aria-selected`, roving
`tabIndex`, and ArrowLeft/ArrowRight/Home/End navigation (automatic
activation). Optional `ariaLabel` names the tablist. Default active style:
`border-accent text-accent bg-accent-soft`.

- `panelId`: id of the single `role="tabpanel"` element. Each tab gets
  `id={tabElementId(panelId, tab.id)}` and `aria-controls={panelId}`; the
  panel sets `aria-labelledby={tabElementId(panelId, active)}`. Used by the
  Settings modal and the debug drawer.
- `TabItem.trailing`: node rendered after the label (count / badge chips).
- Wrap long tab rows in `overflow-x-auto` and pass `className="min-w-max"`
  so they scroll instead of wrapping on mobile.

### Switch

Binary toggle: `role="switch"` + `aria-checked`, `label` is the accessible
name. `size`: `sm` (32x16) / `md` (36x20). Track is `bg-primary` when on and
`bg-border-strong` when off; the thumb is `bg-primary-foreground` so it stays
visible in both themes. Used by the Harness settings tab.

### Toast

| Prop    | Type                           | Default   |
|---------|--------------------------------|-----------|
| show    | boolean                        | -         |
| message | string                         | -         |
| type    | `success` / `error` / `info`   | `success` |
| onClose | () => void                     | -         |

The `role="status"` / `aria-live="polite"` region is always mounted (fixed
bottom-right) and the toast renders inside it, so every message is
announced. Visual: `bg-elevated border-border rounded-md`, icon tinted
`success` / `danger` / `accent`.

### CopyButton

Copies `text` and flips to `copiedLabel` for 2 seconds (icon and label turn
`text-success`). Props: `text`, `label`, `copiedLabel`, `className`,
`iconClassName`, `title`.

### StatCard

Stat tile: `text-2xs` muted label, bold mono value, optional hint.
`tone`: `default` / `success` / `accent` / `warning`.

### ProgressBar

`role="progressbar"` track with `aria-valuenow`; `value` clamps to 0-100.
Fill defaults to `bg-accent`; override with `barClassName`. Pass `label` to
set `aria-label` whenever no visible text names the bar.

### Kbd

`<kbd>` keycap: `text-2xs`, `bg-surface-hover border-border rounded-sm`.

## Accessibility Contract

- Icon-only buttons MUST carry `aria-label`; decorative icons get
  `aria-hidden="true"`.
- Destructive row actions are visible on keyboard focus
  (`focus-visible:opacity-100`) and require a confirmation step (see
  `SessionListItem`).
- Toggle buttons expose state with `aria-pressed`; disclosures use
  `aria-expanded` + `aria-controls`.
- Status text that changes asynchronously lives in a `role="status"` region;
  failures use `role="alert"`.
- Purely visual text effects (the streaming token scramble) are
  `aria-hidden`, with the final text exposed in an `sr-only` span.

## Three-State Standard (Loading / Error / Empty)

Setiap komponen yang merender data dari query WAJIB membedakan tiga state:

+-------------------------------+-------------------------------------------+
| State                         | Render                                    |
+-------------------------------+-------------------------------------------+
| Query pending tanpa data      | Indikator loading ("Loading...", skeleton)|
| (isInitialLoading)            | — BUKAN empty state                       |
+-------------------------------+-------------------------------------------+
| Query error tanpa data        | Pesan error + tombol Retry (`refetch`)    |
| (isError && length === 0)     |                                           |
+-------------------------------+-------------------------------------------+
| Query error DENGAN data lama  | Banner "Failed to refresh" + Retry; data  |
| (placeholderData terisi)      | lama tetap tampil                         |
+-------------------------------+-------------------------------------------+
| Sukses & kosong               | Empty state asli ("No recent chats",      |
|                               | WelcomeHero, EmptyState)                  |
+-------------------------------+-------------------------------------------+
| Resource tidak ada / ditolak  | Not-found state + aksi pemulihan          |
| (hasApiStatus(err, 403, 404)) | ("Conversation not found" + New chat)     |
+-------------------------------+-------------------------------------------+

Aturan:

- Empty state TIDAK boleh dirender saat data masih dimuat atau gagal dimuat
  — keduanya akan terlihat seperti "tidak ada data" (bug UX: mis. list chat
  hilang padahal ada).
- Semua query memakai `QUERY_STANDARD` (`src/lib/query-standard.ts`) sehingga
  data lama bertahan saat refetch error (react-query v5 membuang data saat
  error). Lihat `tanstack-query-setup.md`.
- Membuka modal/drawer tidak pernah mengosongkan state — modal adalah state
  lokal; cache dan store tidak disentuh.

Referensi implementasi kanonik:

- `src/features/chat/components/sidebar/SessionList.tsx` — tiga-state + banner
  refresh-error
- `src/features/chat/components/ChatPage.tsx` +
  `chat-page/ChatBodyStates.tsx` — skeleton saat ganti sesi, not-found,
  error state messages (empty) + banner (dengan data)
- `src/features/studio/components/prompts/PromptLibrary.tsx` — loading
  skeleton + error block + EmptyState

## Dependencies

- `@/utils/cn` — `cn()` for className merging (clsx + tailwind-merge)
- `lucide-react` — icons

## Source References

| File                                   | Description                                       |
|----------------------------------------|---------------------------------------------------|
| src/components/ui/Button.tsx           | Variants, sizes, loading state                    |
| src/components/ui/Input.tsx            | Token-styled input with `aria-invalid` state      |
| src/components/ui/Badge.tsx            | Status / tag badge                                |
| src/components/ui/Modal.tsx            | Accessible dialog with focus trap                 |
| src/components/ui/DropdownMenu.tsx     | Overflow action menu                              |
| src/components/ui/Tabs.tsx             | ARIA tablist (+ `tabElementId` for tabpanels)     |
| src/components/ui/Switch.tsx           | ARIA switch toggle                                |
| src/features/debug/components/TraceStatusBadge.tsx | Shared trace status pill (traces pages, debug drawer) |
| src/components/ui/Toast.tsx            | Live-region toast                                 |
| src/lib/api-client.ts                  | `ApiError` / `hasApiStatus` for not-found states  |

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
