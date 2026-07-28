---
name: wiki
description: "Use when the user wants to ingest sources into the wiki, query existing knowledge, or lint the knowledge base for issues. Manages a persistent, interlinked knowledge base (LLM Wiki) with three operations: ingest, query, lint."
tags: [wiki, memory, knowledge, ingest]
---

# LLM Wiki

A persistent, compounding knowledge base. The assistant writes and maintains the
wiki; you curate sources, direct analysis, and ask questions. The point is that
context accumulates: what you learned in March is still there in November, linked
to everything it touches.

## Architecture

Three layers:

- **Sources** (`content/sources/`) — raw, immutable input documents (transcripts,
  articles, PDFs). Never modified by the assistant.
- **Wiki** (`content/memory/`) — markdown pages written by the assistant.
  `content/memory/CLAUDE.md` is the navigation hub.
- **Schema** (`CLAUDE.md` + this skill) — governs structure and operations.

Pages start as flat siblings inside `content/memory/`. Once a theme grows enough to
deserve its own folder, give that folder its own `CLAUDE.md` navigation node and
register it in the hub's Deep-Dive Navigation table.

## Operations

### Ingest

Process a raw source from `content/sources/` into wiki pages.

**Input:** path to a source file.

**Steps:**

1. Read the source document fully.
2. Identify key information:
   - **Decisions** made and their rationale
   - **Action items** and who owns them
   - **People** mentioned (names, roles, context) — capture on the relevant
     project/concept page, never as standalone pages
   - **Concepts/themes** discussed
   - **Contradictions** with existing wiki content
3. For each new concept/theme that deserves its own page, create one:
   ```yaml
   ---
   type: concept
   name: Concept Name
   first_seen: YYYY-MM-DD
   ---
   ```
4. Update existing project and concept pages with new information from the source.
   Add cross-references (`[link text](other-page.md)`) between related pages.
5. Update `content/memory/CLAUDE.md`:
   - Add new pages to the appropriate section (Projects, Concepts, Preferences)
   - Update one-line summaries if they've become stale
6. Delete the source file from `content/sources/` — it has been fully processed.

**Rules:**

- Never modify files in `content/sources/`. They are immutable.
- **Never create person pages.** People are documented inline on the project or
  concept pages where they are relevant (e.g. a collaborators table or section).
- One page per entity (project, concept). If a page already exists, update it —
  don't create a duplicate.
- Every new page must be added to `content/memory/CLAUDE.md`.
- Delete each source file after processing — `content/sources/` should be empty
  when all ingestion is done.
- Use relative links between wiki pages.
- Frontmatter `type` field is required on all pages: `project`, `concept`,
  `preference`, or `synthesis`.

### Query

Answer questions using the wiki as the primary knowledge source.

**Steps:**

1. Read `content/memory/CLAUDE.md` to identify relevant pages.
2. Read those pages.
3. Synthesize an answer with citations to specific wiki pages.
4. If the answer represents a valuable synthesis (comparison, analysis,
   connection), offer to file it as a new wiki page of type `synthesis`.

**Rules:**

- Always cite which wiki pages informed the answer.
- If the wiki doesn't contain enough information, say so and suggest sources to
  ingest — don't fill the gap with guesses.

### Lint

Health-check the wiki. Run periodically or on request.

**Checks:**

1. **Orphan pages** — files in `content/memory/` not listed in its `CLAUDE.md`.
2. **Broken links** — references to pages that don't exist.
3. **Stale content** — pages not updated in 30+ days that reference active projects.
4. **Missing cross-references** — pages mentioning entities that have their own
   page, without linking to them.
5. **Contradictions** — claims in one page that conflict with another.
6. **Missing pages** — entities mentioned across multiple pages that lack their own
   dedicated page.
7. **Index drift** — one-line summaries in the hub that no longer match the page.

**Output:** a report listing issues found and suggested fixes. Apply fixes only
with confirmation.
