# Post-launch backlog — example

Everything held back from the first release, plus the work that arrived around it.
One row per item, each carrying a priority you can set in the **Plan → Backlog** tab
or by editing the table below — both write to this file.

> **This file is an example.** It exists so a fresh clone has something to look at.
> Replace it with your own board: rename it, point `src/backlog-config.ts` at the new
> name, and delete this one. A board id that matches no file opens empty and offers to
> add the first row, so there is no migration step.

> **Format is load-bearing.** The dashboard parses the table under `## Items`: one row
> per item, columns in the order given, and the `ID` must be unique. Rows you add by
> hand appear in the app on the next load; rows you add in the app appear here.

**Priorities:** `P0` now · `P1` this quarter · `P2` later · `P3` nice-to-have ·
blank = not yet scored, which sorts **first, above `P0`** — not because it is urgent, but
because it is the only row needing a decision from you rather than work from the team.

**Ref** (`EX-07`) is the short handle to use in a thread, a doc or a meeting. It is
assigned once and never reused, even if the row is deleted. The **ID** beside it is the
file key the app writes through — it stays a readable slug so a change is legible in
`git diff`. The letter prefix is taken from whatever the rows already use, so a board
of `EX-` refs keeps issuing `EX-`; `refPrefix` in the config only names the prefix for
a board that has no rows yet.

**Added** is the date an item entered *this list*, not when the need first appeared.
New rows are stamped automatically.

**Products:** `Web` · `Mobile` · `Both` (genuinely spans the two — kept as its own value
rather than forced into one, because forcing it is how a shared dependency loses its
owner). Rename these in `src/backlog-config.ts`; the names here must match it exactly.

**Statuses:** `Draft` (a candidate nobody has reviewed yet — deliberately excluded from
the capacity totals) · `Backlog` (reviewed, in the running) · `In flight` (being built
now — tracked, not planned, and out of your capacity) · `Dropped` (decided against —
kept, and hidden behind a toggle, so the decision stays made instead of being
re-proposed next quarter).

**Effort** is read as weeks. `3w`, `3` and `3 weeks` all count as three; anything the
parser cannot read counts as unsized and is reported separately rather than as zero —
a total that quietly treats unknowns as free is worse than no total.

<!-- next-ref: 7 -->

## Items

| Ref | ID | Added | Priority | Squad | Item | Area | Effort | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| EX-06 | saved-filters | 2026-01-12 |  | Web | Saved filters on the results list |  |  | Draft | Unscored on purpose — this is what an untriaged row looks like, and it sorts to the top until someone decides. |
| EX-05 | offline-mode | 2026-01-12 | P0 | Mobile | Offline mode for the trip view | Sync | 4w | Backlog | Agreed at the quarter review. The single largest committed item. |
| EX-04 | push-notifications | 2026-01-12 | P0 | Mobile | Push notifications on status change | Sync | 2w | Backlog |  |
| EX-03 | audit-log | 2026-01-12 | P1 | Both | Audit log for admin actions | Platform | 3w | Backlog | Spans both surfaces, so it is marked Both and shows under either filter. |
| EX-02 | bulk-export | 2026-01-12 | P2 | Web | Bulk export to CSV |  | 1w | Backlog |  |
| EX-01 | dark-mode | 2026-01-12 | P3 | Both | Dark mode |  |  | Dropped | Kept rather than deleted, so the decision stays made. Tick "Show dropped" to see it. |
