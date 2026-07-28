# Example

One file per bucket — rename this to a squad or topic (`deposits.md`, `my-squad.md`)
and the tab shows one group per file. Delete it once you have real notes.

Each meeting is a `### YYYY-MM-DD — Title` block, newest first. Action items are live
checkboxes in the UI: ticking one writes back to this file. The `Owner:` field decides
whether an item counts as yours — matched against `VITE_OWNER_NAME` in `.env`.

### 2026-07-28 — Weekly sync

**Attendees:** you, Mona, Hubot

**Key decisions:**
- Refunds ship behind a flag; the flag comes out once finance signs off on the reconciliation report.
- Legacy pricing adapter is deleted rather than deprecated — nothing depends on it.

**Discussion highlights:**
- Checkout latency is dominated by partner lookups, not pricing.
- Staging drifted from production for three days before anyone noticed.

**Open questions:**
- Who owns the reconciliation report — us or finance?

**Action items:**
- [ ] Draft the flag-removal checklist (Owner: Your Name) — Deadline: 2026-07-31
- [ ] Confirm the reconciliation owner with finance (Owner: Mona)
- [x] Post the staging-drift postmortem (Owner: Your Name)

### 2026-07-24 — Partner escalation

**Attendees:** you, Hubot

**Key decisions:**
- Hold the integration until the partner confirms their webhook retry policy.

**Action items:**
- [ ] Write up the retry requirements and send them over (Owner: Your Name)
- [ ] Chase the partner's technical contact (Owner: Hubot) — Deadline: 2026-07-30
