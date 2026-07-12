================================================================================
  UI Components
================================================================================
  Module    : UI Components
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

A set of reusable, unstyled-yet-styled primitive UI components located in `src/components/ui/`. Each component uses `cn()` (clsx + tailwind-merge) for className merging and follows a consistent pattern with `forwardRef`, display names, and variant/size props.

## File Structure

```
src/components/ui/
├── Badge.tsx
├── Button.tsx
├── Card.tsx
├── Input.tsx
└── Skeleton.tsx
```

## Flow Diagram

### Component Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│              All components follow the same pattern:                │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  Import: React, cn() utility                              │     │
│   └──────────────────────┬────────────────────────────────────┘     │
│                          v                                         │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  Props: Extend native HTML attributes + custom variants   │     │
│   └──────────────────────┬────────────────────────────────────┘     │
│                          v                                         │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  Styling: cn() merges base classes + variant map +        │     │
│   │           className prop                                  │     │
│   └──────────────────────┬────────────────────────────────────┘     │
│                          v                                         │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  Export: Named export (React.forwardRef where applicable) │     │
│   └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### Button

+-------------+------------------------------------------+-----------------+----------------------------------+
| Prop        | Type                                     | Default         | Description                      |
+-------------+------------------------------------------+-----------------+----------------------------------+
| variant     | 'primary' | 'secondary' | 'ghost'       | 'primary'       | Visual style                     |
|             | | 'danger'                               |                 |                                  |
+-------------+------------------------------------------+-----------------+----------------------------------+
| size        | 'sm' | 'md' | 'lg'                         | 'md'            | Size preset                      |
+-------------+------------------------------------------+-----------------+----------------------------------+
| isLoading   | boolean                                  | false           | Shows a spinner and disables     |
+-------------+------------------------------------------+-----------------+----------------------------------+
| ...props    | ButtonHTMLAttributes                     | —               | Native button attrs              |
+-------------+------------------------------------------+-----------------+----------------------------------+

Variant styling:
- `primary`: `bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20`
- `secondary`: `bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700`
- `ghost`: `bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white`
- `danger`: `bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white`

Size values:
- `sm`: `h-8 px-3 text-xs`
- `md`: `h-10 px-4 text-sm`
- `lg`: `h-12 px-6 text-base`

### Card

+---------------+------------------------------------------------------+
| Sub-component | Description                                          |
+---------------+------------------------------------------------------+
| Card          | Root container — rounded-xl border border-zinc-800   |
|               | bg-zinc-900/50 backdrop-blur-sm                      |
+---------------+------------------------------------------------------+
| CardHeader    | Header wrapper — flex flex-col space-y-1.5 p-6       |
+---------------+------------------------------------------------------+
| CardTitle     | Title text — text-lg font-semibold leading-none      |
|               | tracking-tight                                       |
+---------------+------------------------------------------------------+
| CardContent   | Content body — p-6 pt-0                              |
+---------------+------------------------------------------------------+

All sub-components accept `className` and standard `HTMLAttributes<HTMLDivElement>`.

### Input

+-----------+--------+---------+---------------------+
| Prop      | Type   | Default | Description         |
+-----------+--------+---------+---------------------+
| type      | string | —       | HTML input type     |
+-----------+--------+---------+---------------------+
| className | string | —       | Additional classes  |
+-----------+--------+---------+---------------------+
| ...props  | InputHTMLAttributes | — | Native input attrs |
+-----------+--------+---------+---------------------+

Styling: `flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm`

### Badge

+-----------+----------------------------------------------------------+-----------+------------------------+
| Prop      | Type                                                     | Default   | Description            |
+-----------+----------------------------------------------------------+-----------+------------------------+
| variant   | 'default' | 'outline' | 'success' | 'warning' | 'danger'| 'default' | Color variant          |
+-----------+----------------------------------------------------------+-----------+------------------------+
| ...props  | HTMLAttributes<HTMLDivElement>                           | —         | Native div attrs       |
+-----------+----------------------------------------------------------+-----------+------------------------+

Variant styling:
- `default`: `bg-zinc-800 text-zinc-100`
- `outline`: `border border-zinc-700 text-zinc-400`
- `success`: `bg-emerald-500/10 text-emerald-500 border border-emerald-500/20`
- `warning`: `bg-amber-500/10 text-amber-500 border border-amber-500/20`
- `danger`: `bg-red-500/10 text-red-500 border border-red-500/20`

### Skeleton

+-----------+--------+------------------------------------------------------+
| Prop      | Type   | Description                                          |
+-----------+--------+------------------------------------------------------+
| className | string | Width/height/border-radius via className             |
+-----------+--------+------------------------------------------------------+
| ...props  | HTMLAttributes<HTMLDivElement> | Native div attrs            |
+-----------+--------+------------------------------------------------------+

Styling: `animate-pulse rounded-md bg-zinc-800/50`

## Dependencies

### Internal

- `@/utils/cn` — `cn()` for className merging

### External

- `clsx` — conditional classname joining
- `tailwind-merge` — intelligent Tailwind class conflict resolution

## Source References

+-----------------------------------+---------+---------------------------------------------+
| File                              | Lines   | Description                                 |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Button.tsx      | 1-47    | Button with variants, sizes, loading state  |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Button.tsx      | 10-44   | forwardRef implementation                   |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Card.tsx        | 1-39    | Card, CardHeader, CardTitle, CardContent    |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Input.tsx       | 1-23    | Input with focus ring, disabled state       |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Badge.tsx       | 1-29    | Badge with 5 color variants                 |
+-----------------------------------+---------+---------------------------------------------+
| src/components/ui/Skeleton.tsx    | 1-15    | Skeleton loading placeholder                |
+-----------------------------------+---------+---------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
