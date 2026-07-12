================================================================================
  Types
================================================================================
  Module    : Types
  Service   : Desktop
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Deskripsi

The desktop app uses TypeScript types defined locally within components and global type augmentations in the preload layer. There is no centralized `types.ts` file — types are co-located with their consumers.

## File Structure

```
src/
├── preload/
│   └── index.d.ts                    # Global Window augmentation
└── renderer/
    └── src/
        ├── components/
        │   ├── Chat.tsx              # Message, Model (local interfaces)
        │   └── ui/
        │       ├── button.tsx        # ButtonProps (CVA-based)
        │       ├── input.tsx         # InputProps
        │       ├── label.tsx         # Label props via Radix
        │       └── select.tsx        # Uses Radix types
        └── lib/
            ├── utils.ts              # ClassValue from clsx
            └── api.ts                # No custom types
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Global Types               Component Types                         │
│  ┌─────────────────────┐   ┌─────────────────────────────────────┐  │
│  │  index.d.ts         │   │     Chat.tsx                        │  │
│  │                     │   │                                     │  │
│  │  Window {           │   │  interface Message {               │  │
│  │   electron          │   │    id: number                      │  │
│  │   api               │   │    role: "user" | "agent"          │  │
│  │  }                  │   │    content: string                 │  │
│  └─────────────────────┘   │  }                                  │  │
│                             │                                     │  │
│                             │  interface Model {                 │  │
│                             │    id: string                      │  │
│                             │  }                                  │  │
│                             └─────────────────────────────────────┘  │
│                                                                     │
│  UI Component Types        External Types                          │
│  ┌─────────────────────┐   ┌─────────────────────────────────────┐  │
│  │  button.tsx         │   │  @tanstack/react-query              │  │
│  │                     │   │  useQuery / useMutation             │  │
│  │  ButtonProps        │   │                                     │  │
│  │  extends            │   │  @radix-ui/react-*                  │  │
│  │  ButtonHTML         │   │  Primitive types                    │  │
│  │  Attributes         │   │                                     │  │
│  │  + VariantProps     │   │  axios                              │  │
│  └─────────────────────┘   │  AxiosResponse                      │  │
│                             └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Type Definitions

### 1. Global Window Augmentation

```
src/preload/index.d.ts:3-7
```

```typescript
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}
```

- Augments the global `Window` interface so renderer code can access `window.electron` and `window.api` with type safety
- `api` is `unknown` — update when custom IPC methods are added

### 2. Chat Component Types (local)

```
src/renderer/src/components/Chat.tsx:11-19
```

```typescript
interface Message {
  id: number
  role: "user" | "agent"
  content: string
}

interface Model {
  id: string
}
```

- Defined locally in `Chat.tsx` (not exported)
- `Message` drives the message list rendering
- `Model` shapes the model selection dropdown

### 3. Button Component Types

```
src/renderer/src/components/ui/button.tsx:33-37
```

```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}
```

- Extends native `<button>` attributes with CVA variant props
- `asChild` enables Radix Slot polymorphism

### 4. Input Component Types

```
src/renderer/src/components/ui/input.tsx:5-6
```

```typescript
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}
```

- Pure extension of native input attributes — no custom additions

### 5. Utility Function Types

```
src/renderer/src/lib/utils.ts:4-6
```

```typescript
import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]): string
```

- `ClassValue` imported from `clsx` library

## Notable Omissions

- No shared `types.ts` barrel file
- No API response/request interfaces (Axios responses typed inline or via generics in `useMutation`)
- No Electron IPC event payload types (no custom IPC channels yet)

## Source Refs

+---------------------------------------------+-----------------------------+------------------------------------------+
| File                                        | Type(s)                     | Role                                     |
+---------------------------------------------+-----------------------------+------------------------------------------+
| src/preload/index.d.ts                      | Window.electron, Window.api | Global declarations                      |
+---------------------------------------------+-----------------------------+------------------------------------------+
| src/renderer/src/components/Chat.tsx        | Message, Model              | Chat data models                         |
+---------------------------------------------+-----------------------------+------------------------------------------+
| src/renderer/src/components/ui/button.tsx   | ButtonProps                 | Button component props                   |
+---------------------------------------------+-----------------------------+------------------------------------------+
| src/renderer/src/components/ui/input.tsx    | InputProps                  | Input component props                    |
+---------------------------------------------+-----------------------------+------------------------------------------+

================================================================================
  © 2026 Echo — All Rights Reserved
================================================================================
