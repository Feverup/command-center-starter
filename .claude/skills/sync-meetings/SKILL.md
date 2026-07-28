---
name: sync-meetings
description: >
  Sync meeting notes from a Google Drive folder into local `content/meetings/*.md`,
  keeping only your PENDING (not-done) action items plus a link to each source doc.
  Use when asked to "sync meetings", "re-sync meetings", "update meeting notes", or
  "pull meeting summaries". This is the Drive-pull path — see `meeting-processor`
  for the Granola-direct path.
---

# Sync Meetings (Drive → local)

Pulls per-bucket meeting-summary Google Docs from a Drive folder into local
`content/meetings/<bucket>.md` files. Each file shows **only your own pending
action items** plus a link to the source doc, so the dashboard's Meetings tab stays
a short, skimmable to-do view.

Use this instead of `meeting-processor` when your notes already live in Drive — or
as the fallback when Granola's API blocks scripted access.

## Setup

Needs the `gws` CLI authenticated against your own Google account (see the
`google-workspace-cli` skill). Fill in:

- **Source folder:** Drive folder id `<your-folder-id>`, holding docs named
  `Meeting Summaries — <Bucket>` (one per bucket).
- **Output:** `content/meetings/<slug>.md` (slug = bucket lowercased, spaces →
  hyphens).
- **Owner filter:** the names that mean *you* in an action item — `{{NAME}}`, your
  initials, "me", first person.

**No such folder yet?** Then this skill has nothing to sync, and that's a fine
place to be. Say so and offer these, in order:

1. **You have meeting notes in Drive** — ask for the folder id (or its URL), sync
   it, and write the id into this Setup block so the next run doesn't ask again.
2. **You use Granola** — the `meeting-processor` skill pulls from there instead.
   Its bucket mapping needs filling in the same way.
3. **Neither** — leave `content/meetings/` alone. The Meetings tab renders
   hand-written notes perfectly well; `content/meetings/example.md` shows the
   shape. Add a task to configure a source later rather than forcing it now.

**Never invent buckets** from whatever documents happen to be findable. A bucket is
a decision about how someone organises their work, not something to guess at — a
wrong guess costs them an afternoon of undoing it.

## Steps

1. **List the folder** (build the params JSON with python to avoid quoting issues):

   ```bash
   gws drive files list --params '{"q":"'\''<your-folder-id>'\'' in parents and trashed=false","fields":"files(id,name)"}'
   ```

2. **Read each doc:** `gws docs documents get --params '{"documentId":"<id>"}'` —
   strip the `Using keyring backend` banner before the first `{`, then walk
   paragraphs **and table cells** to get the text.

3. **Filter** to items that are BOTH (a) yours, by the owner filter above, AND
   (b) still **pending**. Exclude `[x]`, `☑`, `✅`, struck-through, and anything
   marked done/closed/completed; keep `[ ]`, `☐`, and unmarked lines.

4. **Write** each `content/meetings/<slug>.md`, overwriting:

   ```markdown
   # <Bucket> — Meeting Summaries

   📄 **Source:** [<Bucket> doc](https://docs.google.com/document/d/<DOC_ID>/edit) · _my pending actions only_

   ## My pending actions
   - <pending action>  (— date/deadline if present)
   ```

   No pending items → `## My pending actions` followed by `- _(none pending)_`,
   still including the source link. Create files for new bucket docs; don't delete
   a local file whose source doc has disappeared.

5. **Report** per file: pending actions kept, plus what changed since the last sync
   (new docs, newly-completed items, newly-added items).

## Notes

- Files only — no app code, no calendar writes. The dashboard's **Meetings** tab
  renders these files.
- For a large pull, delegate to a sub-agent to keep the main context clean; the
  procedure is identical.
- Don't commit automatically unless asked.
