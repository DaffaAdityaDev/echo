# Katara Frontend: Routing Architecture

> Next.js 16 App Router route table, authenticated shell layouts, and full-screen practice runners.

---

## 1. Route Table

| Route Path             | Type      | Component Orchestrator                           | Description                              |
| ---------------------- | --------- | ------------------------------------------------ | ---------------------------------------- |
| `/login`               | Public    | `src/app/login/page.tsx`                         | Login & registration form                |
| `/`                    | Protected | `src/app/(katara)/page.tsx`                      | Daily Dashboard & Practice Feed          |
| `/library`             | Protected | `src/app/(katara)/library/page.tsx`              | Knowledge Lakes & Source manager         |
| `/library/sources/:id` | Protected | `src/app/(katara)/library/sources/[id]/page.tsx` | Source flashcards & TipTap notes         |
| `/drill/:sessionId`    | Protected | `src/app/(katara)/drill/[sessionId]/page.tsx`    | Full-screen Practice Runner (no sidebar) |
| `/progress`            | Protected | `src/app/(katara)/progress/page.tsx`             | Mastery Matrix & Weekly Synthesis        |
| `/settings`            | Protected | `src/app/(katara)/settings/page.tsx`             | Daily goals & FSRS configurations        |

---

## 2. Layout Structure

```tsx
// src/app/(katara)/layout.tsx
<AuthGuard>
  <div className="flex h-full w-full overflow-hidden bg-base">
    <Sidebar /> {/* Hidden automatically when path starts with /drill/ */}
    <main id="main-content" className="flex-1 overflow-y-auto scrollbar-thin">
      {children}
    </main>
  </div>
</AuthGuard>
```
