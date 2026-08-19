================================================================================
  KataraGnosis TipTap Editor Integration
================================================================================
  Module    : Editor Integration
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

TipTap v2 provides the Notion-like block editing experience (ADR-07).
It is used in two places:

  1. Source detail (library/sources/[id]): read + edit flashcard content
     and write free-form notes attached to a source.
  2. Manual flashcard creation: compose a card and save it (POST
     /katara/flashcards, source='manual').

Dependencies
------------

  @tiptap/react ^2.10+          (React 19 compatible)
  @tiptap/pm ^2.10
  @tiptap/starter-kit ^2.10     (paragraph, heading, bold, italic, list,
                                 blockquote, code)
  @tiptap/extension-placeholder ^2.10
  @tiptap/extension-link ^2.10
  @tiptap/extension-task-list ^2.10 + @tiptap/extension-task-item
  @tiptap/extension-table ^2.10 + table-row + table-cell + table-header
  @tiptap/extension-typography ^2.10   (smart quotes, ellipsis)

Editor Components (features/library/components/editor/)
-------------------------------------------------------

  KataraEditor.tsx          headless wrapper: useEditor({ extensions, ... })
  EditorToolbar.tsx         floating/inline toolbar (bold, italic, heading,
                            list, task list, table, link, quote, code)
  SlashMenu.tsx             "/" popup: Paragraph, Heading 2/3, Bullet List,
                            Task List, Table, Blockquote, Code Block
  useKataraEditor.ts        hook owning editor lifecycle + serialization

Serialization
-------------

  - HTML -> stored as content HTML in flashcards.content? NO: content is
    plain text for flashcard atomic cards (AI indexing + embedding work
    best on clean text). Rule:
      * flashcard.content  = plain text (getText())
      * notes column       = HTML (getHTML()) stored in a `notes_html`
        JSONB on sources — rendered read-only with a sanitizer on the
        source detail page.
  - getText() output is normalized: collapse blank runs, trim trailing
    whitespace.

Save Paths
----------

  +-----------------------------+-------------------------------------------+
  | Action                      | API                                        |
  +-----------------------------+-------------------------------------------+
  | Edit flashcard content      | PATCH /katara/flashcards/:id (text only)   |
  |                             | -> backend re-embeds + re-upserts Qdrant   |
  | Save note on source         | PATCH /katara/sources/:id {notes_html}     |
  | Create manual flashcard     | POST /katara/flashcards with domain/       |
  |                             | sub_topic/archetype/keypoints picked via   |
  |                             | metadata side panel (or AI-suggested via   |
  |                             | katara.atomize on the pasted text)         |
  +-----------------------------+-------------------------------------------+

UX Details
----------

  - Placeholder per locale: "Mulai menulis catatan... (tekan / untuk
    menu)".
  - Table support with keyboard navigation (Tab to move cells).
  - Slash menu filters by typed text after "/".
  - Auto-save: debounce 1.5s -> PATCH; "Tersimpan"/"Menyimpan..." status
    indicator (Indonesian UI copy).
  - The editor is never used for exam answers (drill uses a plain textarea
    for short_answer — speed over formatting).

Accessibility & Perf
--------------------

  - All toolbar buttons: <button aria-label="Tebal"> etc., keyboard
    shortcut hints (Ctrl+B).
  - Dynamic import: const KataraEditor = dynamic(() => import(...),
    { ssr: false }) — TipTap runs client-side only.
  - React Compiler enabled (next.config reactCompiler: true) — no
    manual memoization.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
