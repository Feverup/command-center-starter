---
name: eng-health
description: >
  Refresh the Signals ▸ Eng Health tab: your squad's SLOs (target vs actual), open
  incidents, top error issues and merged-PR / revert throughput including a 12-month
  trend, written to `content/team/eng-health.json`. Pulls Datadog through whichever
  Datadog MCP server you have connected and GitHub through `gh`, scoped by
  `content/team/eng-health-scope.json`. Use when asked to "refresh eng health",
  "eng health", "what's breached", "squad SLOs", "open incidents", "revert rate",
  or when the tab's ↻ button runs it.
---

# Eng Health — snapshot refresh

Writes one file, `content/team/eng-health.json`, which the Eng Health tab renders as
is. No app code. A field the skill could not fill is `null` and the tab shows it as a
gap ("Not loaded", "—"), never as a zero.

## Setup — `content/team/eng-health-scope.json`

Every number is scoped by this file. Read it first, every run (rosters change).

```json
{
  "squadName": "Payments",
  "github": {
    "organizations": ["your-org"],
    "authors": ["octocat", "hubot"],
    "authorsFromProject": ""
  },
  "datadog": {
    "teamTag": "team:payments",
    "errorQuery": ""
  }
}
```

- `github.organizations` — empty falls back to `VITE_GITHUB_ORGS` in `.env`.
- `github.authors` — the squad's GitHub handles. Or leave it empty and set
  `authorsFromProject` to a project slug from the PR tab (`.data/projects.json`) to
  reuse that roster, so the squad is defined in one place.
- `datadog.teamTag` — the tag your SLOs and error-tracking issues carry. Scope by
  **this tag alone, never by service**: services are shared and a service filter
  silently hides SLOs the squad owns.
- `datadog.errorQuery` — optional override for the error-tracking search. Empty means
  `<teamTag>` with open/for-review issues only.

**Scope not configured** (file missing, or no authors and no `teamTag`):
- *Interactive:* ask for the org, the handles (or which PR-tab project to reuse) and
  the Datadog team tag, write the file, then carry on.
- *Headless (the ↻ button):* do **not** write `eng-health.json` — say which fields
  are missing and stop. Overwriting the example with a file of nulls helps no one.

A lane whose half of the scope is missing (no `teamTag`, say) returns `null` and the
other lanes still run.

## Steps

1. **Read** `content/team/eng-health-scope.json` and the current
   `content/team/eng-health.json` (the baseline, and the shape).
2. **Gather — three lanes, spawned as parallel subagents in one message.** Each gets
   its brief from [`references/lanes.md`](references/lanes.md) plus the scope and the
   window with exact dates. They exist to keep raw Datadog and GitHub payloads out of
   this context; each returns a JSON fragment and a provenance table, nothing else.

   | Lane | Returns | Default window |
   |---|---|---|
   | Datadog SLOs + incidents | `slos[]`, `incidents[]` | 30d |
   | Datadog error tracking | `sentry[]` (top 5) | 7d |
   | GitHub delivery | `deploys` incl. `byMonth[]` | 7d / 30d / 12 months |

   **A failed lane returns `null`.** Merge the `null`; never carry a value forward
   from the baseline. A stale number silently substituted is the one failure the tab
   cannot show.
3. **Merge and compute `summary`:**
   - `slosBreached` = count of `slos[]` with `status: "breached"` (`null` if `slos` is `null`),
   - `openIncidents` = count of `incidents[]` with `status: "open"` (`null` if `incidents` is `null`),
   - `deploysLast7d` = `deploys.last7d`,
   - `revertRate` = `revertPRs7d ÷ last7d` as a string like `"5.6%"` (`null` if either is `null` or `last7d` is 0).
4. **Preserve `remediation`.** For any SLO still `breached` that carries a
   `remediation` block in the baseline, copy it across unchanged. It is a human claim
   ("the cause is fixed, the rolling window hasn't caught up") the skill cannot
   re-derive; dropping it re-opens settled work. **Never edit `status` itself** — that
   is Datadog's measurement.
5. **Check before writing.** Re-derive every `summary` figure from the arrays; confirm
   each non-null figure appears in a lane's provenance with a query and a window;
   confirm nothing equals the baseline only because a lane failed. Fix what fails.
6. **Write** `content/team/eng-health.json`:

   ```json
   {
     "generatedAt": "YYYY-MM-DD",
     "source": "<one line: which Datadog server, gh, scope file>",
     "summary": { "slosBreached": 0, "openIncidents": 0, "deploysLast7d": 0, "revertRate": "0.0%" },
     "slos": [{ "name": "", "target": "", "actual": "", "status": "ok|at-risk|breached|no-data", "window": "30d", "remediation": null }],
     "incidents": [{ "id": "", "title": "", "severity": "", "status": "open|resolved", "opened": "YYYY-MM-DD", "url": "" }],
     "sentry": [{ "issue": "", "events": 0, "users": 0, "level": "", "url": "" }],
     "deploys": {
       "last7d": 0, "last30d": 0, "revertPRs7d": 0,
       "note": "Merged PRs by squad authors — a throughput proxy, not deploy events. The last month is to date.",
       "byMonth": [{ "month": "YYYY-MM", "merged": 0, "reverts": 0, "revertRate": 0.0, "revertPrs": [] }]
     },
     "_provenance": { "<field>": "<query> · <window>" }
   }
   ```

   Sort worst-first: breached → at-risk → no-data → ok SLOs; open incidents before
   resolved; errors by event count. `sentry` is the key the tab reads even though the
   source is Datadog — keep the name.
7. **Report** in a few lines: what moved since the baseline (new breaches, incidents
   opened or closed, revert-rate change) and every lane that failed, with why.

## Rules

- **Read-only everywhere.** No Datadog mutations; with `gh`, read-only subcommands
  and `gh api` GETs only — no comments, reviews, issue writes, or `-X POST/PATCH/PUT/DELETE`.
- **Authenticate once.** If the Datadog MCP errors on auth, report it (re-auth is
  `/mcp`) and leave that lane `null`. Do not retry a dead token.
- **No Datadog server connected at all** is a normal state: both Datadog lanes return
  `null`, the GitHub lane still runs, and the report says so.
- **Don't commit** the file unless asked.
