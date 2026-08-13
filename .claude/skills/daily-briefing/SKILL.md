---
name: daily-briefing
description: Daily briefing / morning briefing — reconciles yesterday's plan, then today's calendar, urgent Slack signals, Gmail inbox, GitHub PR queue and the `content/tasks/active.md` Standing backlog; proposes today's top 3 and red flags; writes the briefing into `content/tasks/active.md` as a new "Today" block and archives yesterday's into `content/tasks/journal.md`. Use when asked about the plan, agenda, to-do, schedule, what's on my plate, what to work on, morning briefing, top 3 for today, or any synonym.
---

# Daily Briefing

Your complete daily picture, assembled from your calendar, mail, Slack, PR queue
and task backlog — then written back into your task files.

- **`content/tasks/active.md`** — the live list: a `## 🔭 Standing / Carrying`
  backlog (edited in place, never re-dated) plus a single
  `## 📌 Today — YYYY-MM-DD` block.
- **`content/tasks/journal.md`** — the per-day archive; yesterday's reconciled
  Today block is appended here each morning.

## Setup

Steps 1a and 1f need the `gws` CLI authenticated against your own Google account
(see the `google-workspace-cli` skill). Steps 1b, 1d need `gh` and Slack access.
**Any source you haven't set up is skipped, not faked** — say so in one line and
carry on with the rest. The briefing still works with nothing but the task file.

These are filled in by `.claude/scripts/setup/apply-placeholders.sh` during
`/setup`. Edit them here when they change, or delete what doesn't apply:

- **Your GitHub login:** `{{GH_HANDLE}}`
- **Your Slack member ID:** `{{SLACK_ID}}`
- **Slack channels worth scanning:** {{SLACK_CHANNELS}}
- **Timezone:** `{{TIMEZONE}}`
- **Your role:** {{ROLE}} — shapes what counts as *your* work versus someone
  else's. A lead's queue legitimately includes unblocking other people; an IC's
  mostly doesn't.
- **Your current goal:** {{GOAL}} — the tiebreaker when ranking the Top 3 in Step 2.

## When to trigger

Anything that means "give me the big picture of my day": "what's my plan/agenda?",
"what should I work on?", "what's on my plate?", "morning briefing", "top 3 for
today". Do **not** trigger for narrow lookups ("what's my next meeting?").

## Step 0 — Reconcile yesterday

Read `content/tasks/active.md` and find the `## 📌 Today — <prior date>` block.
Show its Top 3 and Other priorities and ask, in ONE message: *"Yesterday you
planned X / Y / Z — what landed, what slipped, what's dropped?"* Use the answer
(plus any verifiable signal: merged PRs, sent Slack, calendar attendance) to mark
each line `✅ done` / `🏗️ in progress` / `❌ dropped` / `⏭️ carried`. You'll archive
this block in Step 3.

Skip only if today's block already carries today's date (briefing already run) or
there is no prior block yet.

## Optional — fan-out mode

By default Step 1 gathers every source **in this context**, which is the right design for most
people. If your sources are large enough that this blows out the context window, there is an
optional subagent architecture — seven source agents plus a prioritizer and a critic — in
`references/fanout-mode.md`.

Read that file before switching: fan-out is measurably **slower** (it costs whatever your slowest
source costs, plus two serial verification stages) and the context saving is smaller than it
looks. It is an answer to a context problem, not a speed or cost optimisation. Start here.

## Step 1 — Gather data IN PARALLEL

Issue these in a single message. Never sequential.

**1a. Calendar** — today's events (see the `google-workspace-cli` skill):

```bash
gws calendar events list --params '{"calendarId": "primary", "timeMin": "YYYY-MM-DDT00:00:00Z", "timeMax": "YYYY-MM-DDT23:59:59Z", "singleEvents": true, "orderBy": "startTime"}'
```

Pipe through python to get `HH:MM - HH:MM  Title` per line.

**1b. GitHub PR queue** — your open PRs and review requests:

```bash
gh search prs --review-requested={{GH_HANDLE}} --state=open
gh search prs --assignee={{GH_HANDLE}} --state=open
```

Buckets: (1) approved and waiting on your merge, (2) yours waiting on reviewers,
(3) drafts. The dashboard's Pull requests tab covers the per-squad view.

**1c. Tasks** — `Read` `content/tasks/active.md`. Plan from the
`## 🔭 Standing / Carrying` backlog plus the current Today block. Do **not** load
`journal.md` unless you need history for a specific item.

**1d. Urgent Slack** — last 16h across your monitored channels, DMs, and
@mentions of your member ID. Surface: any @mention, any `*-alerts` message, and
urgency-keyword hits. Search rules: no boolean operators (space = AND, never write
`OR`); one query per keyword (urgent, blocker, escalation, broken, P0, P1, ASAP,
down, help); a dedicated `<@your-slack-id> after:YYYY-MM-DD` for mentions.

**1e. Gmail inbox** — mail that genuinely needs you. Don't rely on one narrow
query; a single unread-only pass misses read-but-open threads. Two passes:

```bash
# Pass 1 — fresh unread (last 24h)
gws gmail +triage
# Pass 2 — wider net for security/partner/ops mail that may be read or older
gws gmail users messages list --params '{"userId":"me","q":"newer_than:14d (security OR compromise OR password OR urgent OR legal OR partner OR incident) -category:promotions -category:social","maxResults":30}'
```

Read the body of any hit (`gws gmail +read --id <ID>`). Keep ONLY what needs you:
direct asks, decisions awaiting you, security/legal/finance notices, calendar
changes, anything time-sensitive. Drop newsletters, automated digests, CC-only
FYIs. Synthesize — never dump the inbox. Mandatory training, compliance, HR and
IT-security mail **is** actionable even from a no-reply sender: surface it as a
task rather than filtering it out. **Never copy credentials or PII into the
briefing or task files — reference the message ID instead.**

## Step 2 — Present the picture

Greeting adapts to time of day. Sections, in order:

**📅 CALENDAR** — per event: time, title, whether it's skippable or delegable,
prep needed. Flag zero-buffer stretches (3+ back-to-back, <5min gaps). Or: "No
meetings today — full day for deep work."

**🔴 URGENT SLACK** — grouped needs-reply / FYI / can-ignore. Skip if nothing.

**📧 INBOX** — grouped needs-reply / decision-awaiting / FYI. One line each:
sender — subject — why it matters. Skip the section entirely if nothing qualifies.
Any mail implying an action becomes a task in Step 3.

**✅ TASKS** — every OPEN item from the Standing backlog, with a proposed
Eisenhower classification (Do now / Schedule / Delegate / Backlog). **Propose; the
user reviews.** PRs awaiting review always land in "Do now". One line per task
with a 2–4 word tag and its `Nd` age. Show all open tasks — no silent filtering.

**⭐ TOP 3 FOR TODAY** — THE one thing, plus 2 supporting, plus 1 thing NOT to do
today (delegate or say no). Top 3 items are **deliverables and actions, never
calendar meetings** — if a meeting matters, surface its *prep* as the task.

Rank on urgency first, then break ties with the goal in Setup above ({{GOAL}}): of
two equally pressing tasks, the one that moves the goal wins. Say which tiebreak
you applied in one clause — "over X, because it moves {{GOAL}}" — so a wrong read
of the goal is visible and correctable. Never promote a `[P3]` nice-to-have into
the Top 3; if it genuinely belongs there, its priority was wrong, so fix the
marker in Step 3 rather than quietly overriding it.

**🚩 RED FLAGS** — needs attention but not top 3: stale items where live state was
expected, unresponded asks from required attendees, no-buffer meetings, unprepped
commitments landing today, long-silent dependencies blocking a P0. **Chronic
carry-forwards:** any Standing item carried ≥3 briefings (~14d+) gets a forced
verdict — do-it-today / delegate-to-X / formally-drop. Don't let it silently ride
a fourth time.

Status taxonomy on every item: ✅ DONE (source + when) · 🏗️ IN FLIGHT (last
activity) · 🔴 STALE (no activity 3+ days → chase/drop/escalate) · ❓ UNKNOWN
(say what you'd check; don't ask). If everything is ✅/🏗️, the briefing is
SHORTER. Don't pad.

## Step 3 — Write back to the files

Two plain file edits — no API, no sync to fight.

1. **Archive yesterday → `content/tasks/journal.md`:** append the reconciled prior
   Today block (with its `✅/🏗️/❌` glyphs from Step 0). **Re-title the heading to
   `## YYYY-MM-DD` — NOT `## 📌 Today — …`.** The dashboard's journal parser only
   recognizes headings starting with a bare ISO date; an emoji or `Today` prefix
   makes the entry silently invisible in the app.

2. **Refresh `content/tasks/active.md`:**
   - **Update Standing in place** — bump each open item's `Nd` age, flip glyphs,
     add anything durable surfaced today, remove items now done or dropped (they
     live in the journal now).
   - **Replace the `## 📌 Today` block** with today's date and content:

```markdown
## 📌 Today — YYYY-MM-DD

**Top 3:**
1. [the ONE thing]
2. [supporting priority]
3. [supporting priority]

**🚫 Do NOT do today:** [delegation candidate]

**📋 Other priorities:**
- [rest of list]

**✅ What landed:** *(fill at end of day)*
```

`active.md` always holds exactly one Today block. Git is the safety net —
`git diff content/` shows exactly what changed.

## Step 4 — Confirmation pass

Per top-3 item: "Still live, or resolved/queued?" If resolved, drop it and re-rank
from the live pool. Yesterday was reconciled in Step 0; this is about today's
freshly-proposed three.

Order: **Step 0** → gather (1) → present (2) → write back (3) → confirm (4).
