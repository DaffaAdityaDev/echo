================================================================================
  KataraGnosis Frontend Library (Notion-like)
================================================================================
  Module    : Library
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

The library is the Notion-like reading and authoring space:
sidebar (lake tree) + source list + flashcard reader + TipTap editor +
semantic search + upload. The UI copy is Bahasa Indonesia; code English.

Pages
-----

  /library                     LakeLibraryPage (default: first lake)
  /library/sources/[id]        SourceDetailPage

Layout
------

  +------------+-----------------------------------------------------+
  | Sidebar    | Main                                                  |
  |            |                                                       |
  | + Lakes    |  LibraryHeader: search + "Tambah Sumber" (upload)     |
  |   v BI     |                                                       |
  |   v Piano  |  Source list (cards): title, type icon, status badge, |
  |            |  flashcard_count, updated, menu (download, reprocess, |
  |            |  delete)                                              |
  |            |                                                       |
  |            |  SourceDetail:                                       |
  |            |    tabs: Kartu (flashcards) | Catatan (editor)       |
  |            |    flashcard list with domain/sub_topic chips +       |
  |            |    keypoints; click -> expanded card + linked         |
  |            |    questions count + SRS badge (due date)             |
  +------------+-----------------------------------------------------+

Components (features/library/components/)
-----------------------------------------

  LakeSidebar.tsx        lake tree, active highlight, "Buat Lake" modal,
                         mastery dot per lake, archive via context menu
  UploadZone.tsx         drag-drop + file picker (pdf/md/txt, <= 50 MB);
                         on drop -> mutation + job poll progress bar
                         ("Mengunggah...", "Memproses: 2/5 tahap",
                         "Selesai")
  SourceCard.tsx         status badge (Uploaded/Processing/Ready/Failed +
                         error tooltip), delete confirm modal
  ChunkList.tsx          flashcard cards grouped by sub_topic, position
                         ordering, filter chips (domain/sub_topic/archetype)
  ChunkCard.tsx          content (collapsible), keypoints bullets, SRS
                         due badge, edit (opens editor), delete
  KataraEditor.tsx       TipTap wrapper (editor-integration.md)
  SearchPanel.tsx        semantic search results (ranked, score, preview,
                         source link); falls back gracefully to filter
                         chips, never to ILIKE (backend 503 -> banner)

Upload Flow (upload + polling)
------------------------------

  1. UploadZone -> POST /api/katara/sources (FormData, progress bar)
  2. 201 {sourceId, jobId}
  3. useJobPoll(jobId): refetchInterval 3s -> progress_stage rendered
  4. done -> invalidate sources + chunks; failed -> red banner with
     job.error
  5. auto-navigate to /library/sources/[sourceId] on success

Reader (flashcard view)
-----------------------

  - Read-only markdown rendering via shared Markdown component (react-
    markdown + remark-gfm + remark-math + rehype-katex — same stack as
    frontend/web).
  - "Pelajari" button per flashcard: opens a quick single-card drill
    (spawns a 1-question drill session) — the bridge between reading and
    testing.
  - Keypoints are rendered as a bullet list with copy-to-clipboard.

Semantic Search UX
------------------

  - Debounced input (400ms) -> POST /api/katara/flashcards/search.
  - Results: flashcard preview (content_preview), score %, source + lake
    badges; click navigates to source chunk (scroll to position).
  - Empty query -> hide panel (filter chips remain).
  - 503 banner when Qdrant is down (fail-hard, ADR-01).

Manual Flashcard Creation
-------------------------

  "Buat Kartu" button -> modal:
    - KataraEditor for content (plain text extraction on save)
    - fields: domain, sub_topic, archetype (select), keypoints (list
      editor), lake_id, source_id optional
    - optional "Bantu isi metadata" -> calls katara.atomize on the text
      and prefills the fields (LLM suggestion, user approves)
    - save -> POST /katara/flashcards -> invalidate lists

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
