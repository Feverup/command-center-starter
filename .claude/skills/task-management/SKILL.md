---
name: task-management
description: "Use when creating or editing a task in the local `content/tasks/active.md` list, an external issue tracker, or anywhere. Not for read-only task lookups."
---

# Task Management

Your tasks live in **`content/tasks/active.md`** — a plain markdown file, read and
edited with normal file tools and versioned by git. The Tasks tab in the dashboard
reads and writes the same file, so both stay in sync automatically.

- **Read:** `Read` the file `content/tasks/active.md`.
- **Add:** `Edit` the file — put the task under the right `### ` group inside
  `## 🔭 Standing / Carrying` if it's a durable backlog item, or under
  `## 📌 Today` if it's for today. New durable items get a `— 0d` carried-age tag.
- **Complete / drop:** `Edit` the line — flip `☐` → `✅` (done), `🏗️` (in
  progress) or `❌` (dropped). Done and dropped items move out of Standing; they
  belong in the journal.
- **Reorder / reprioritise:** `Edit` in place.

No backups needed — `git diff content/` is the safety net.

## File structure

```markdown
## 🔭 Standing / Carrying

### 🔥 Urgent + Important
- ☐ **[P0]** A single action [@label] — 3d

### 🎯 Important, Not Urgent
### ⚡ Urgent, Not Important
### 🌱 Neither — someday

## 📌 Today — YYYY-MM-DD

**Top 3:**
1. …
2. …
3. …

**🚫 Do NOT do today:**
**📋 Other priorities:**
**✅ What landed:**
```

Conventions the dashboard understands:

- **Groups** are the four Eisenhower quadrants by default. Rename them freely —
  the parser takes whatever `###` headings it finds.
- **`[@slug]` label chips** are defined in `content/team/task-labels.json` and get
  a colour in the UI. Keep the `[@slug]` *before* the `— Nd` age.
- **`[P0]`/`[P1]`/`[P2]`** in the bold title means now / this cycle / later.
- **`**Top 3:**` must be written exactly like that**, with a numbered list under
  it, or the dashboard silently shows no Top 3.
- The per-day archive is `content/tasks/journal.md`. Entries need `## YYYY-MM-DD`
  headings or the dashboard hides them.

## MANDATORY: one action per task (atomic)

Every task line = exactly **one** independently-checkable action. Never bundle.
This applies everywhere, **including the `📌 Today` Top 3**.

Split-it anti-patterns (all mean "write separate lines"):

- `+` joining verbs, `; then`, `, then`, `these 3…`
- a `→` chain — "prepare → validate with X → present" = **three** tasks
- one line covering deliverables that land at different times — "invoice
  structure (wholesale + commission)" when wholesale ships now and commission is
  a later sprint = **two** tasks

A shared meeting, owner, source, or theme does **NOT** justify one line. When a
meeting or request yields several actions, write one line per action even if
repetitive; consolidate only true duplicates of the *same* action. Where actions
are sequential, note the dependency in the text ("after the draft is ready") but
keep them separate.

**Today ↔ Standing are the same tickets.** Build the Top 3 and Other priorities by
*selecting* existing atomic Standing tickets (verbatim titles), never by writing a
thematic summary. Closing a Today item closes its Standing twin in the **same
edit**, and vice versa. Anything in Today must have a Standing home — no orphans.

## External issue trackers own their issues

If a task is backed by an external tracker (Jira, Linear, GitHub Issues),
internalise this before any action that touches it:

- Never edit a local mirror of those issues. All mutations go through the
  tracker's own API or CLI.
- Reading from a local mirror is the fast path for context; writes are not.
- `content/tasks/active.md` is your own list — this no-write policy applies only
  to issues that live in a tracker.
