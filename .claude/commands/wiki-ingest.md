---
name: wiki-ingest
description: >
  Process a single source into the content/memory/ wiki and tasks (the local `content/tasks/active.md` list). Accepts a generic input
  (file path, URL, pasted text, or an MCP reference), loads relevant context, proposes a
  scope of candidate points for the user to select via AskQuestion, then writes only the
  approved entries into the right pages.
---

## Goal
Process a source into the [**memory**](../../content/memory/CLAUDE.md) layer and **tasks** (the local `content/tasks/active.md` list, via the [`task-management`](../skills/task-management/SKILL.md) skill).

The input is **generic**: it can be a file path, a URL, raw text pasted directly into the chat, or a reference to content reachable via an MCP server (e.g. a meeting transcript, a chat thread, an issue tracker item, a shared doc). An input is **mandatory** — the command does nothing without one.

## Workflow

Follow these steps strictly and in order. Use `TodoWrite` to track progress through each step.
  5  ### Step 1: Acquire the input

The input arrives as `$ARGUMENTS`. **If it is empty**, prompt the user for a source (text, URL, file path, or MCP reference) and **stop**. Otherwise, go to Step 2.

### Step 2: Load context

Starting from the root [`CLAUDE.md`](../../CLAUDE.md), follow the Deep-Dive Navigation table recursively into the sub-areas relevant to the source. Read the most likely affected pages so you avoid duplication and contradiction.

### Step 3: Propose ingest scope and align with the user

Before touching any pages, surface what's worth ingesting and let the user pick exactly what to keep. **This avoids spending tokens on details that don't deserve to be remembered, and avoids landing content in the wrong layer.**

Present the candidate points directly through the `AskQuestion` tool as a single multi-select question (`allow_multiple: true`), so the user just selects which entries to ingest. Order the options by significance (most significant first), and make each option label self-contained, with each part on its own line: a significance tag (**[strongly worth ingesting]**, **[worth a brief mention]**, or **[probably not worth ingesting]**) and short title, the destination file(s), and a one-line summary of the substance. For example:

```
[strongly worth ingesting] Continuous-discovery cadence
[`content/memory/concepts/continuous-discovery.md`]
adopt biweekly customer interviews
```

**If a candidate point's destination is ambiguous** (e.g. could land as either a work-area update *or* a concept-page update), say so in the option label and name the better fit.

Ingest exactly the selected entries in Step 4. If the user has already indicated relevant points in the command invocation, still present the full set of candidate options — the prompt is a hint, not a final scope.

### Step 4: Execute the approved scope

Apply each approved write directly. For each target page: read it first to understand current content and placement, then add/update/move the content at the right spot (after which heading, before which section, at the end of which list).

Follow these rules on every write:

1. All markdown links must be standard markdown: `[label](relative/path.md#anchor)`. Never use `[[wikilinks]]`.
2. References to external-tracker items must be clickable links to their source URL, never bare IDs.
3. No authorship timestamps in memory pages: no `first_seen`, `last_updated`, no `Update YYYY-MM-DD:` markers. Keep dates that are real-world events.
4. Don't add or modify frontmatter timestamps. Keep existing `type` and `name` fields.
5. Match the existing writing style of each file — concise, no filler, bold for key terms.
6. Don't create person pages unless explicitly told to — capture inline first.
7. Task entries go to `content/tasks/active.md` via the `task-management` skill (file `Edit`) — add new `☐` items under the right `## 🔭 Standing / Carrying` subsection. Don't restructure existing items unless explicitly told to.
8. New memory pages get frontmatter: `type: concept | preference | person | synthesis`, `name`.

### Step 5: Report

Respond verbatim "ingestion successfully finished"
