================================================================================
  KataraGnosis Frontend Routing
================================================================================
  Module    : Routing
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

App Router structure copied from frontend/web conventions: every page is a
"use client" pure orchestrator (calls a page-hook, passes props to a page
component). Pages never fetch data or touch stores directly.

Route Table
-----------

+--------------------------+--------------------------------------------------+
| Route                    | Page (page-hook -> component)                   |
+--------------------------+--------------------------------------------------+
| /login                   | LoginPage (features/auth)                       |
| /                        | DashboardPage (features/progress)               |
| /library                 | LibraryPage (features/library)                  |
| /library/sources/[id]    | SourceDetailPage (features/library)             |
| /drill/[sessionId]       | DrillPage (features/drill)                      |
| /progress                | ProgressPage (features/progress)                |
| /settings                | SettingsPage (features/settings)                |
+--------------------------+--------------------------------------------------+

Authed Shell ((katara) route group)
-----------------------------------

  app/(katara)/layout.tsx:
    <AuthGuard>
      <Sidebar />           // lake tree + nav (Dashboard, Library, Progress)
      <main>{children}</main>
    </AuthGuard>

  - Sidebar lists lakes (GET /katara/lakes) with flashcard_count and
    mastery dot (green/yellow/red from /progress light endpoint).
  - Drill pages render full-screen (hide sidebar) like frontend/web chat
    routes: layout detects route segment and toggles.

Page Orchestrator Pattern
-------------------------

  app/(katara)/library/page.tsx:

    "use client";
    import { LibraryPage, useLibrary } from "@/features/library";

    export default function LibraryRoute() {
      const props = useLibrary();
      return <LibraryPage {...props} />;
    }

Dynamic Params
--------------

  - useParams() for /library/sources/[id] and /drill/[sessionId].
  - Drill session id is ALSO kept in the URL so a refresh resumes the
    session (mix.answered guard on the backend).

BFF Layer
---------

  app/api/... route handlers proxy to the Go backend (api-client.md):

  /api/auth/{login,me,logout}/route.ts
  /api/katara/lakes/route.ts, [id]/route.ts
  /api/katara/sources/route.ts, [id]/{route,[id]}, [id]/chunks/route.ts,
    [id]/reprocess/route.ts
  /api/katara/flashcards/route.ts, [id]/route.ts, search/route.ts
  /api/katara/drills/route.ts, [id]/{route,next,answer,results}/route.ts
  /api/katara/today/route.ts, progress/route.ts,
    synthesis/weekly/route.ts
  /api/katara/jobs/[id]/route.ts

Loading & Error States
----------------------

  - app/loading.tsx (skeleton), app/error.tsx (retry boundary) —
    mirroring frontend/web.
  - All pages must render explicit empty states in Bahasa Indonesia
    (e.g., "Belum ada lake. Buat lake pertama untuk mulai.").

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
