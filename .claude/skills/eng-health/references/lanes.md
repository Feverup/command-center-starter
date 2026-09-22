# Eng Health — lane briefs

Hand each subagent **the shared contract plus its own lane**, the scope from
`content/team/eng-health-scope.json`, and the window as exact dates.

## Shared contract — every lane

**You exist to keep raw payloads out of the main session.** Pull wide, return narrow:
the figures and where they came from, never the dump.

- **Every figure carries its query and its window**, or it cannot be re-derived next time.
- **A source that fails returns `null`** — never a guess, never a previous value. Say
  in `### Failed` what broke and what you tried.
- **Authenticate once.** An auth error is reported, not retried.
- **Read-only.** You gather; you do not write anywhere, and you do not editorialise.
- **Sort worst-first** within each array.

Your entire final message:

````
## <lane> — <window with dates>

### JSON fragment
```json
{ ...exactly the keys your lane specifies... }
```

### Provenance
| Field | Query / call | Window |
|---|---|---|

### Notes
- <what the numbers do not show>

### Failed
- <source, what you tried, what it returned — or _(none)_>
````

Valid JSON only in the fragment — it is merged directly.

---

## Lane 1 — Datadog SLOs + incidents

Use the connected Datadog MCP server's SLO search and incident search tools. If no
Datadog server is connected, return `{"slos": null, "incidents": null}` and say so.

- `slos[]` — `{name, target, actual, status, window}`, 30-day window preferred.
  - Query by the scope's `teamTag` **only — never add a service filter.**
  - **Read every page.** Search tools page at ~25; a squad often has more.
  - `status`: `ok | at-risk | breached | no-data`. An SLO with no events in the
    window is `no-data` with `actual: null` — it is not healthy; include it.
  - A breached SLO whose API response has no SLI value keeps `actual: null`. Do not
    supply a plausible percentage.
  - An SLO tagged to more than one team goes in `### Notes` with the ownership
    question, not in the array.
- `incidents[]` — `{id, title, severity, status: open|resolved, opened, url}` for
  incidents tagged to the team in the window, open first, then by severity.

## Lane 2 — Datadog error tracking

Use the connected Datadog MCP server's error-tracking issue search. Query: the scope's
`errorQuery`, or else the `teamTag` restricted to open / for-review issues, ordered by
total count, last 7 days. No Datadog server → `{"sentry": null}`.

- `sentry[]` — top 5, `{issue, events, users, level, url}`, most events first.
- **Event count is not severity.** Where the title makes the surface obvious (a
  checkout path vs a retried background job), say so in `### Notes`.

## Lane 3 — GitHub delivery (`gh`)

Scope by **squad-member `author:` across the scope's organizations** — not by repo;
shared monorepos overstate a squad by an order of magnitude. Authors: `github.authors`,
or the `authors` of the project named by `authorsFromProject` in `.data/projects.json`.
No `gh` auth, or no authors → `{"deploys": null}`.

- Totals via `gh api "search/issues?q=<query>" --jq .total_count` — a plain list
  caps at 30 and undercounts.
- One query per window with every author as its own qualifier:
  `is:pr is:merged org:<org> author:a author:b … merged:<from>..<to>`.
  Use the `..` range — two separate `merged:>=` / `merged:<` qualifiers are not a
  range and return the all-time total.
- Reverts: the same query plus `in:title revert`.
- `deploys` — `{last7d, last30d, revertPRs7d}` plus `byMonth[]` for the last 12
  calendar months: `{month: "YYYY-MM", merged, reverts, revertRate, revertPrs}`, where
  `revertRate` is a number (reverts ÷ merged × 100, one decimal) and `revertPrs` is
  `[{number, url, repo, author, title}]` for that month's reverts.
- Say in `### Notes` that merged PRs are a **throughput proxy, not deploy events**,
  and that the last month is **to date**, not a full month.
- Read-only: GET requests only. No comments, reviews or issue writes.
