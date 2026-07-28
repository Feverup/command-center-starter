---
name: compact-session
description: "Capture a chat's working context into a durable session-notes file and emit a copy-paste resume prompt for a fresh chat."
---

# Compact Session

The goal of this command is to capture everything that lives only in the chat's context window — decisions made, scope changes, new state of artefacts, working-style observations, pending work, candidates rejected — into a durable session-notes file. After this command runs, the user can start a fresh chat with a small resume prompt that points at the session-notes file plus the project's other primary artefacts, and pick up exactly where they left off.

This is a chat-end workflow. It produces three outputs:
1. An updated session-notes markdown file (or a new one if none exists).
2. Deletion of any plan files that have been fully superseded by the work in this session.
3. A copy-paste resume prompt that the user pastes into the new chat.


## Workflow

Follow these steps strictly and in order. Use `TodoWrite` to track progress.

### Step 1: Identify the project and locate the session-notes file

1. From the conversation history, identify which project this session has been about (e.g. "wiki migration", "team rollout"). If ambiguous between two, ask the user before proceeding.
2. Convert the project name to a kebab-case slug (e.g. `wiki-migration`).
3. Look for an existing session-notes file at `/tmp/<slug>-session-notes.md`.
   - If it exists, read it fully. This is the prior state you're updating.
   - If it doesn't exist, you're creating a new one. The slug above is the destination path.
   - **Why `/tmp/`**: keeps session notes ephemeral, prevents accumulation in the agent's plans directory, and avoids any chance of accidentally committing them into the workspace. Caveat: `/tmp/` may be cleaned by the OS (macOS typically clears after a few days of staleness; reboots are usually safe). If the file is gone when starting a fresh chat, fall back to recreating from the resume prompt + workspace artefacts.
4. Confirm the path with the user in a single sentence (*"Compacting into `/tmp/<slug>-session-notes.md` — proceed?"*) and wait for ack. They may want a different slug or path. Honor exactly what they say.

### Step 2: Inventory plan files that might be superseded

1. List all plan files in the agent's plans directory (e.g. `~/.cursor/plans/`) matching `*.plan.md`. If your agent doesn't keep plan files, skip this step.
2. For each plan file that relates to this project (matched by name, content, or the work done in this session), assess whether the work is fully done / superseded.
3. Present the candidates to the user as a ranked list (use plain chat — it's lightweight alignment). For each: plan filename, one-line summary, your verdict (`superseded` / `still active` / `partially done`).
4. Wait for the user's instruction. They'll tell you which (if any) to delete. Honor exactly. **Don't delete anything in this step yet** — deletion happens after the session-notes file has been written.

### Step 3: Synthesize the session into the notes-file structure

Before writing, mentally organise this session's substance under the standard sections (below). The structure is canonical — don't invent new top-level sections without reason. Keep wording tight and high-signal; this file is read in full at the start of every fresh chat.

**Section template:**

```markdown
# Session continuation notes — <Project Name>

> Attach this file plus the primary artefacts (below) to a fresh chat to resume iteration
> with full context but a small context window. This file captures the **reasoning trail,
> locked decisions, user preferences, and pruned candidates** that aren't in the
> artefacts themselves.

## Primary artefacts (read in this order)

> Note on paths: workspace-relative vs absolute paths called out per item.

1. This file (absolute path).
2. ... (workspace-relative work-area file, e.g. `content/memory/<page>.md`)
3. ... (workspace-relative source-of-truth artefacts)
4. ... (current artefacts being iterated on)

## Session arc (how we got here)

> Chronological log of major iterations, framed with dates. Each entry is 1–3 sentences:
> what changed, why, and the resulting state (counts, version bumps, etc.).
>
> Format: `- **YYYY-MM-DD <time of day>.** <what happened, in past tense>.`
>
> Carry forward the prior arc from the existing session-notes file (if any), append the
> new entries. Don't lose older history unless the user asks you to prune it.

## Current state of artefacts (<YYYY-MM-DD end of session>)

> Where each primary artefact stands at session end. **Flag mismatches** — if the
> visualization is at v5 but the canonical source-of-truth file is still at v3, say so
> explicitly. The next session needs to know about these mismatches up front.

## <Project-specific state section(s)>

> Whatever is canonical-to-this-project state that doesn't fit a generic header.
> Examples: a milestone pool, a design summary, an architectural diagram, a decision log,
> a set of evaluation results. Use as many subsections as needed.
>
> If this state already lives in a workspace file, point there instead of duplicating —
> e.g. "Full milestone Done when / metrics / etc. lives in `data/<file>.js`."

## Methodological invariants (don't re-litigate)

> Principles that govern the work and should not be re-debated session-to-session.
> Carry forward from prior notes + append anything new.

## User working-style preferences

> How to collaborate effectively with the user. Concrete and observed, not abstract.
> Carry forward + append anything newly observed this session.

## Locked decisions

> Specific decisions made (with dates) that should stay decided. Distinguish "cross-cutting
> principles" (very durable) from "structural decisions" (project-specific, locked for now).
> Multiple subsections OK.

## Pending work (priority order)

> Numbered list. Highest priority first. Each item is 1–2 sentences, concrete enough that
> the next session can act on it.

## Pruned candidates (don't re-add)

> Things considered and rejected, with the reason in one line. Carry forward + append.
> Important so a fresh chat doesn't re-suggest something already debated.

## Recent ingests / inputs informing current-state

> Sources, transcripts, decks, etc. that fed into the current state. Carry forward + append.

## Resume bootstrap for fresh chat

> A suggested first message the user can paste into the new chat to invoke this file.
> Single italic block-quote, ~3 sentences. The new chat reads this file first, then uses
> the file's "Primary artefacts" list to bootstrap context.
```

**Rules for the synthesis:**

- **Preserve everything from the prior session-notes file** unless it's been explicitly superseded or the user asks you to prune it. The session notes are append-mostly.
- **Absorb superseded plan files' substance** into the appropriate sections (decisions, state, pending work, pruned candidates) before they're deleted in Step 5. After the deletion, this file is the canonical home for that substance.
- **Carry forward locked decisions, principles, and pruned candidates exactly** — don't paraphrase or summarise unless they've been refined this session.
- **Flag artefact mismatches loudly.** If the visualization is ahead of the canonical pool, or task/work-area notes are ahead of the wiki, the "Current state" section names the gap.
- **Write the resume bootstrap concretely.** It must reference this exact session-notes file by absolute path, and the project's primary artefacts list by workspace-relative paths.

### Step 4: Write the session-notes file

1. Apply the synthesis from Step 3 to produce the full file contents.
2. Write the file to the path confirmed in Step 1 (overwriting the prior version, or creating fresh).
3. Read the file back to verify it landed correctly.

### Step 5: Delete superseded plan files (if any)

1. For each plan file the user approved in Step 2:
   - Delete it.
   - Verify the deletion.
2. If none were approved for deletion, skip this step.

### Step 6: Emit the resume prompt

Output a copy-paste resume prompt as a fenced markdown block in chat. Structure:

````
You're picking up an in-progress project — the <Project Name>. I'm starting a fresh chat
to keep the context window light; most state lives in files, and the conversational
context that doesn't is in a session-notes file.

Read these files in order before responding to anything else.

Note on paths: item 1 is an **absolute path under `/tmp/`** — session notes live there
intentionally so they stay ephemeral and never get committed. Items 2+ are inside the
workspace.

1. `/tmp/<slug>-session-notes.md` — READ THIS FIRST. <brief
   summary of what's inside>. If this file is missing (e.g. `/tmp/` was cleaned by the
   OS), say so explicitly and ask me to either point at a recovered copy or rebuild from
   the workspace artefacts.

2. <next file> — <one-line purpose>.

3. <next file> — <one-line purpose; flag any out-of-sync state inline>.

... (continue with all primary artefacts)

After reading, give me a short confirmation (3–5 sentences):
- Where we are in the project, including any artefact-mismatch state.
- <Domain-specific confirmation request based on this project's current state.>
- The single highest-priority pending work and your recommended first concrete step.

Then wait for my direction. <Optional: hint at the next focus area + a "don't make any
edits until I explicitly direct you" clause if the user prefers planning before execution.>
````

The prompt list must match exactly the "Primary artefacts" section of the session-notes file.

### Step 7: Report

Tell the user, in a short paragraph:

- The session-notes file path and what was updated (e.g. *"Updated session arc with 4 new iterations from 2026-05-16, added the impact-hierarchy locked decision, refreshed pending work."*).
- How many plan files were deleted (with names if helpful).
- That the resume prompt is in the message above and ready to paste into the new chat.

Don't restate the resume prompt itself in this report — it's already in the message.

## Important Rules

- **Never overwrite the session-notes file without preserving prior content first.** Always read the existing file in Step 1.
- **Never delete plan files without explicit approval in Step 2.** Even if a plan looks fully done, ask.
- **Don't invent project state.** If you're not sure whether a decision was actually locked vs. proposed, mark it as proposed and let the user confirm.
- **Don't over-summarise the session arc.** Date-stamped entries are the unit; 1–3 sentences per entry is the target. The session arc is the most important section for reconstructing context in a fresh chat.
- **The resume prompt is the user-facing output.** It must be self-contained and pastable. The reader (the fresh-chat agent) won't have access to anything you say outside the fenced block.
- **No emojis.** Plain text and markdown only.
