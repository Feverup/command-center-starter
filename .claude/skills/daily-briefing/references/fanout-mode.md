# Fan-out mode — optional, and not the default

The `daily-briefing` skill gathers its sources **in one context** by default. That is the right
design for most people and you should start there.

Fan-out mode replaces Step 1 with **seven subagents**, one per source, plus a prioritizer and a
critic. It exists for one reason: when your sources are large enough that reading them inline
blows out the main context, and every later turn pays to re-read that bulk.

## Read this before you switch

Fan-out is not free, and the costs are easy to miss:

- **It is slower, not faster.** The lanes run concurrently, but the briefing then costs whatever
  the *slowest* lane costs — and lanes are wildly uneven. In one measured fleet: calendar 63s,
  issue tracker 130s, meetings 249s, Slack 389s, GitHub 700s, 1:1s 956s, mail 991s. The four fast
  lanes finished in six minutes and then sat idle for ten more.
- **It adds two serial stages.** The prioritizer and critic each wait for everything before them.
  Measured at roughly 7 minutes and 7–20 minutes respectively, they were about **60% of total
  wall-clock** — after all the data was already gathered.
- **The context saving is smaller than it looks.** In that same fleet, ~96% of spend was the
  orchestrator's own context, not the subagents. Moving source bulk into lanes helps, but it does
  not change the shape of the bill.

Measured end to end, that fleet's fan-out briefing took **34–43 minutes** to first write. The
inline version takes a few.

**So: use the default. Switch only when you have evidence that your inline briefing is
context-bound** — long sources, many reports, a large mail volume — and be honest about paying
~15 minutes of serial verification for it.

## What ships here

Nine agents in `.claude/agents/`:

| Agent | Model | Source | Cap | Budget |
|---|---|---|---|---|
| `briefing-calendar` | haiku | today's events | ~15 lines | 6 calls |
| `briefing-github` | haiku | PR queue | ~20 lines | 12 calls |
| `briefing-slack` | haiku | channels, DMs, mentions | ~15 lines | 14 calls |
| `briefing-jira` | haiku | own + team stuck issues | ~15 lines | 10 calls |
| `briefing-gmail` | sonnet | inbox, two passes | ~10 lines | 16 calls |
| `briefing-one-on-ones` | sonnet | reports' 1:1 docs | ~4 lines/report | 18 calls |
| `briefing-meetings` | sonnet | local notes + tool | ~4 lines/meeting | 14 calls |
| `briefing-prioritizer` | opus | *(merge)* | 6,000 chars | — |
| `briefing-critic` | sonnet | *(verify)* | 2,000 chars | — |

Plus `source-contract.md` — one shared file every source agent reads, so the output shape and
task rules cannot drift across seven copies.

## The three rules that carry the weight

**1. Spawn all seven in a single message.** They share no data, so they run concurrently. Spawn
them one per message and you serialize the whole fan-out.

**2. The merge is a barrier.** The prioritizer's entire input is the lanes' combined output.
Spawning it alongside the sources gives it nothing to merge, and it will produce a confident
ranking from an empty pool. Wait for all seven, then spawn it alone. Same for the critic after it.

**3. Budgets are self-enforced.** Nothing can interrupt a running subagent — there is no timeout.
The only thing bounding a slow lane is the agent counting its own tool calls, which is why every
agent file states a budget and why `PARTIAL` exists.

## `PARTIAL` — the signal that keeps a truncated lane honest

A lane that hits its budget returns what it has and fills a `PARTIAL` block naming what it did
not cover. **Omitting `PARTIAL` is a positive claim of full coverage.**

Without this, a truncated lane and a genuinely quiet day produce identical output, and the
ranking silently under-reports. In a tool that tells you what to work on, that is the worst
failure mode available: confidently wrong, no error, no empty state.

## Keeping the lane count honest

Both merge agents hardcode the lane count (`<n>/7`). If you add or retire a lane, three places
must change together: the agent files on disk, the count in **both** merge agents, and the table
above.

This drifts silently in both directions. Add a lane and leave the merge counting the old number —
it is gathered, never merged, and the result looks exactly as authoritative as a correct one.
Retire a lane and the merge waits for a return that can never arrive.

Worth a check in your own test suite if you have one. When we wrote that check, the first version
matched one merge agent's exact wording and silently skipped the other, which then sat on a wrong
count undetected. Match the *pattern*, and read every occurrence — and prove the check fails
before you trust it passing.

## Configuration

The agents reuse the template's existing tokens — `{{GH_HANDLE}}`, `{{SLACK_ID}}`,
`{{SLACK_CHANNELS}}`, `{{TIMEZONE}}`, `{{ROLE}}`, `{{GOAL}}` — so enabling fan-out needs no new
setup for those.

Fan-out adds two of its own. They are **fan-out only**, so they are deliberately not in
CLAUDE.md's `## Me` table; set them either by editing the two agent files directly, or by passing
them to the existing script, which already accepts arbitrary `TOKEN=value` pairs:

```bash
.claude/scripts/setup/apply-placeholders.sh "" "" "" \
  JIRA_PROJECT=ABC REPORTS="Ada, Grace, Alan"
```

- `{{JIRA_PROJECT}}` — issue-tracker project key.
- `{{REPORTS}}` — direct reports' names. **Leave unset if you have none.**

Both agents treat an unset value *and* an unsubstituted `{{TOKEN}}` as "not configured" and
return `unavailable` rather than guessing — so a half-finished setup degrades cleanly instead of
inventing a source. Any lane whose source you have not configured does the same, and the briefing
continues without it, saying so out loud.
