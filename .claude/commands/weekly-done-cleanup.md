---
name: weekly-done-cleanup
description: >
  Weekly cleanup of completed items in the local `content/tasks/active.md` list. Runs every Sunday
  morning autonomously. Archives done tasks that no longer provide context for active work into
  content/tasks/done-archive.md; keeps those that still inform ongoing projects, EPICs, or active decisions.
  Use when it's time for the weekly cleanup, or when asked to "clean up done tasks",
  "archive old tasks", "prune the active tasks", or "tidy up my tasks".
---

# Weekly Done Cleanup

Every Sunday, prune the **completed** items (`✅` / `- [x]`) from the `## 🔭 Standing / Carrying` backlog in `content/tasks/active.md` so it stays lean. Completed tasks that still give active work context stay; the rest move to `content/tasks/done-archive.md`. (Per-day history is already archived in `content/tasks/journal.md` by the daily briefing — leave that alone.)

## Why This Matters
Recent completions give the daily briefing context (what was tried, shipped, unblocked) and a sense of momentum. But an ever-growing done list becomes noise. This keeps `content/tasks/active.md` focused on what's relevant this week.

## When to Run
- Every Sunday morning (scheduled task)
- Anytime you are asked to clean up or archive done tasks

## Steps

### Step 1: Load context
Read `CLAUDE.md` and `content/memory/CLAUDE.md` to understand current projects, people, and active initiatives. `Read` the file `content/tasks/active.md` in full.

### Step 2: Evaluate each completed (`- [x]`) item
Only consider checked-off items — never touch open (`- [ ]`) tasks. A completed item is RELEVANT (keep) if any hold:
- It belongs to the same project/EPIC as an open task
- It involves a person mentioned in an open task
- It records a decision/outcome that informs upcoming work
- It was completed within the last 3 days
- Removing it would obscure why something is in its current state

NOT RELEVANT (archive) if: its project is fully done; no open task references the same people/project/EPIC; it's a routine item older than a week with no downstream dependency; it's a one-off unconnected to anything in flight. **When in doubt, KEEP.**

### Step 3: Archive irrelevant completed items
Append them to `content/tasks/done-archive.md` (create if missing). Plain text, no `#` headers:
```
Done Archive


Week of [day] [Month] [Year]

- [x] [Task name] — [Description]. Completed [date].
```

### Step 4: Write the pruned list back
`Edit` `content/tasks/active.md` to remove only the archived `✅` items from the `## 🔭 Standing / Carrying` block. Leave all open (`☐`) items, kept completions, the subsection headings, and the `## 📌 Today` block untouched. (Targeted `Edit`s — never rewrite the whole file blind; `git diff content/` should show only the removed lines.)

### Step 5: Report
```
Weekly cleanup done. [X] completed tasks archived, [Y] kept for context. Open tasks untouched.
```

## Important Rules
- Runs autonomously — make reasonable judgments, don't ask.
- Never delete: archived items go to `content/tasks/done-archive.md`.
- Never touch open (`☐`) tasks — only completed (`✅` / `- [x]`) ones.
- Keep completions from the last 3 days regardless of relevance.
- Use targeted `Edit`s on `content/tasks/active.md`; `git diff` should show only removed `✅` lines. Git is the safety net.
- Archive file uses plain text, no `#` Markdown headers.
- Leave `content/tasks/journal.md` alone — per-day history is the daily briefing's domain.
