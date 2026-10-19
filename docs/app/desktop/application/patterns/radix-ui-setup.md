================================================================================
  Radix UI Setup
================================================================================
  Module    : Radix UI Setup
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The UI layer is built on unstyled, accessible Radix UI primitives wrapped in Tailwind CSS v4 classes with CVA (Class Variance Authority) for variant management. All components follow the shadcn/ui pattern — copy-paste components with full Tailwind control, no external component library runtime.

## File Structure

```
src/renderer/src/components/ui/
├── button.tsx        # Radix Slot + CVA variants
├── card.tsx          # Plain HTML with Tailwind
├── input.tsx         # Plain HTML with Tailwind
├── label.tsx         # Radix Label primitive
└── select.tsx        # Radix Select primitive (full)
```

## Flow Diagram

```
┌─────────────────────────┐     ┌─────────────────────────────────────────┐
│      Component          │     │          Styling Layer                  │
│                         │     │                                         │
│  ┌───────────────────┐  │     │  ┌───────────────────────────────────┐  │
│  │ Button            │──┼─────┼──│ CVA (variant/size)               │  │
│  │ Card              │  │     │  │ Tailwind v4 classes              │  │
│  │ Input             │  │     │  │ cn(clsx + twMerge)               │  │
│  │ Label             │──┼─────┼──│ Radix LabelPrimitive              │  │
│  │ Select            │──┼─────┼──│ Radix SelectPrimitive             │  │
│  └───────────────────┘  │     │  └───────────────────────────────────┘  │
└─────────────────────────┘     │                    │                    │
                                │                    v                    │
                                │          ┌────────────────────────┐    │
                                │          │       main.css         │    │
                                │          │  @theme tokens         │    │
                                │          │  CSS variables         │    │
                                │          └────────────────────────┘    │
                                └────────────────────────────────────────┘
```

## Entry Points

- All UI components live under `src/renderer/src/components/ui/`
- Imported by `App.tsx` and `Chat.tsx` (e.g., `import { Button } from './ui/button'`)
- CSS theme variables defined in `src/renderer/src/assets/main.css`

## Dependencies

+---------------------------+-----------+-----------------------------------------------+
| Package                   | Version   | Purpose                                       |
+---------------------------+-----------+-----------------------------------------------+
| @radix-ui/react-slot      | ^1.2.4    | Polymorphic Slot for Button asChild           |
+---------------------------+-----------+-----------------------------------------------+
| @radix-ui/react-label     | ^2.1.8    | Accessible Label primitive                    |
+---------------------------+-----------+-----------------------------------------------+
| @radix-ui/react-select    | ^2.2.6    | Full Select with portal, scroll, keyboard nav |
+---------------------------+-----------+-----------------------------------------------+
| class-variance-authority  | ^0.7.1    | CVA for variant-based class generation        |
+---------------------------+-----------+-----------------------------------------------+
| tailwind-merge            | ^3.4.0    | twMerge for conflict-free class merging       |
+---------------------------+-----------+-----------------------------------------------+
| clsx                      | ^2.1.1    | Conditional class name construction           |
+---------------------------+-----------+-----------------------------------------------+
| lucide-react              | ^0.563.0  | Icons for Select (ChevronDown, Check)         |
+---------------------------+-----------+-----------------------------------------------+
| tailwindcss               | ^4.0.0    | Utility-first CSS framework                   |
+---------------------------+-----------+-----------------------------------------------+
| @tailwindcss/vite         | ^4.0.0    | Vite plugin for Tailwind v4                   |
+---------------------------+-----------+-----------------------------------------------+
| tailwindcss-animate       | ^1.0.7    | Animation utilities                           |
+---------------------------+-----------+-----------------------------------------------+

## Component Details

### Button (`button.tsx`)

```
src/renderer/src/components/ui/button.tsx
```

- Uses `@radix-ui/react-slot` for `asChild` prop (polymorphism)
- CVA variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- CVA sizes: `default`, `sm`, `lg`, `icon`
- Focus-visible ring styling for accessibility

### Card (`card.tsx`)

```
src/renderer/src/components/ui/card.tsx
```

- Pure HTML `<div>` and `<h3>` elements, no Radix dependency
- Subcomponents: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- All use `cn()` for className merging

### Input (`input.tsx`)

```
src/renderer/src/components/ui/input.tsx
```

- Pure `<input>` element, no Radix dependency
- Border, focus ring, disabled styling via Tailwind

### Label (`label.tsx`)

```
src/renderer/src/components/ui/label.tsx
```

- Wraps `@radix-ui/react-label` primitive
- CVA for consistent typography styling

### Select (`select.tsx`)

```
src/renderer/src/components/ui/select.tsx
```

- Full `@radix-ui/react-select` implementation
- Subcomponents: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectLabel`, `SelectGroup`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`
- Uses `lucide-react` ChevronDown, ChevronUp, Check icons
- Portal-based dropdown with popper positioning

## Styling Approach

### CSS Variables (`main.css`)

```
src/renderer/src/assets/main.css
```

- Tailwind v4 `@theme` directive maps CSS variables (`--color-primary`, `--radius`, etc.)
- Light (`:root`) and dark (`.dark`) color schemes defined as HSL values
- Full shadcn/ui-compatible variable set: background, foreground, primary, secondary, destructive, muted, accent, popover, card, border, input, ring

### Utility Function (`utils.ts`)

```
src/renderer/src/lib/utils.ts:4-6
```

```typescript
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- Combines `clsx` (conditional classes) with `tailwind-merge` (resolves conflicts)
- Used by every UI component for className prop handling

## Source Refs

+-----------------------------------------------+-----------------------------------------------+
| File                                          | Role                                          |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/components/ui/button.tsx     | Button with CVA + Slot                        |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/components/ui/card.tsx       | Card layout components                        |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/components/ui/input.tsx      | Text input                                    |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/components/ui/label.tsx      | Accessible label                              |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/components/ui/select.tsx     | Radix Select dropdown                         |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/lib/utils.ts                 | cn() utility                                  |
+-----------------------------------------------+-----------------------------------------------+
| src/renderer/src/assets/main.css              | Tailwind theme + CSS variables                |
+-----------------------------------------------+-----------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
