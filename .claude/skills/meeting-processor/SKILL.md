---
name: meeting-processor
description: Process yesterday's meetings (or Friday's if today is Monday) from Granola — classify them into buckets, prepend summaries to `content/meetings/<bucket>.md`, and add the action items to `content/tasks/active.md`. Triggers: meeting processor, process meeting notes, yesterday's summaries.
---

# Meeting notes processor (Granola → local)

Granola is only the **source**. Everything written is local and versioned by git:

- **Summaries** → `content/meetings/<bucket>.md`, one file per bucket, newest on top.
- **Action items** → `content/tasks/active.md`.

Nothing is ever written back to Granola. You write the summaries, classify the
action items, and save both with file tools.

## Reading from Granola — `granola_api.py`

Ships alongside this skill. It reads the Granola desktop app's local session, so
there's nothing to configure beyond having the app installed and logged in — no
API key, and no token is ever printed.

```bash
# every meeting for a day, grouped by bucket
python3 .claude/skills/meeting-processor/granola_api.py fetch --date 2026-07-28

# full transcript for one meeting
python3 .claude/skills/meeting-processor/granola_api.py transcript --doc <meeting_id>
```

Tell it which Granola folders are yours — otherwise every meeting lands in
`Uncategorized`, which is the safe default rather than a guessed taxonomy:

```bash
export GRANOLA_FOLDERS="Team meetings,Customer calls,<your folder>"
```

Use the same names as the folder mapping table below, so a folder and its bucket
file stay in step.

**If `fetch` returns 401/403:** open the Granola app once to refresh its token and
re-run. If it still fails, the Granola MCP tools are the fallback for reading
meetings — the write subcommands (`publish`, `prepend`, `set-note`) are
deprecated and shouldn't be used either way.

## Setup — your buckets

A **bucket** is one markdown file in `content/meetings/` and one group in the
dashboard's Meetings tab. Map your own Granola folders to bucket files here:

| Granola folder | Bucket file |
|---|---|
| `<Your folder>` | `content/meetings/<slug>.md` |
| `<Your folder>` | `content/meetings/<slug>.md` |
| _no folder_ | `content/meetings/uncategorized.md` |

Slug = folder name lowercased with spaces as hyphens. The dashboard title-cases
unknown bucket names automatically, so you don't need to register them anywhere.

**Table still empty, or no Granola?** Don't guess a mapping. Ask which Granola
folders should become buckets, or point out the two alternatives: `sync-meetings`
if the notes live in Drive, or writing notes straight into `content/meetings/`
(the Meetings tab reads them either way). Leaving it unconfigured is a valid
outcome — inventing someone's taxonomy is not.

**Optional title overrides** — for recurring meetings that cut across projects and
deserve their own bucket regardless of which folder they're filed under. Applied
**before** the folder mapping:

| Title contains | Bucket file |
|---|---|
| `<keyword>` | `content/meetings/<slug>.md` |

Classification is decided **first** by a title override, otherwise by the Granola
folder. Never invent a bucket.

## Optional — fan-out mode (and a second source)

This skill reads Granola inline. There is an optional subagent architecture in
`references/fanout-mode.md` that runs one agent per source concurrently and adds a critic to
verify the merged draft before anything is written.

Unlike the briefing's optional fan-out, this one usually earns its place: it adds **Google Meet
"Notes by Gemini"** as a second source (meetings Granola never saw), and those docs are
200KB-1.5MB each, so reading them inline dominates the context window.

If you hit **HTTP 403** from `granola_api.py fetch` below, see that file — the Granola MCP tools
were verified working against the same account.

## Steps

**0. TARGET_DATE**
- If today is Monday → TARGET_DATE = today − 3 days (the previous Friday)
- Any other day → TARGET_DATE = today − 1 day
- Format: `YYYY-MM-DD`

**1. Fetch the day's meetings** using the Granola MCP tools (`list_meetings` /
`get_meetings`, and `get_meeting_transcript` when a summary is empty but a
transcript exists). If no meetings are found, output
`"No meetings from {TARGET_DATE} to process."` and stop.

Granola's REST API tends to 403 for scripted access, so prefer the MCP tools. If
they fail with an expired token or `Unsupported client`, open or restart the
Granola app once and retry.

**2. Write one summary per meeting**, grouped by bucket:

```markdown
### YYYY-MM-DD — Meeting title
**Attendees:** …
**Key decisions:** concrete bullets
**Discussion highlights:** 3–5 bullets
**Open questions:** anything unresolved
**Action items:**
- [ ] Action (Owner: X) — Deadline: Y
```

Keep the `Owner:` field — the Meetings tab uses it to split action items into
yours versus everyone else's, matching against `VITE_OWNER_NAME` from `.env`.

**3. Classify every action item**
- `[P0]` — blocks someone, or due this week
- `[P1]` — important, timing flexible
- `[P2]` — nice to have, no dependency

**4. Write the summaries** to `content/meetings/<bucket>.md`. Apply title
overrides first, then the folder mapping. For each bucket with meetings that day,
**prepend** the day's block (newest on top); create the file if missing, with a
`# <Bucket> — Meeting Summaries` H1. Each day sits under a `## YYYY-MM-DD` header.
**If that date's header already exists, skip it** — re-running would duplicate.

**5. Add the action items** to `content/tasks/active.md`. Each becomes a `☐` line
under the right group in `## 🔭 Standing / Carrying`, suffixed
`(from: meeting title) — 0d`. Promote `[P0]` items that block someone or are due
this week into `## 📌 Today` → `📋 Other priorities` as well. Never duplicate an
item that already exists. Follow the `task-management` skill's one-action-per-task
rule: a meeting yielding four actions produces four lines.

**6. Report** meetings processed per bucket, files updated, action items added, and
a warning if anything landed in Uncategorized.

## Rules

- **Never modify the original meetings** in Granola — read only.
- Summaries are **prepend-only**; never touch previous days. Don't re-process a
  date already present.
- Free markdown in the local files — git versions them.
- Don't commit automatically unless asked.
