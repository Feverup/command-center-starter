# Fan-out mode — two sources, read out-of-context, then verified

The `meeting-processor` skill reads Granola inline by default. Fan-out mode replaces that step
with **source agents run concurrently**, one per source, plus a critic that verifies the merged
draft before anything is written.

Unlike the briefing's optional fan-out, **this one usually earns its place**, for two specific
reasons:

- **The documents are genuinely enormous.** Google Meet's "Notes by Gemini" docs run
  **200KB–1.5MB** each — a notes section followed by the entire transcript. Reading a day of
  those inline will dominate the context window and every later turn pays to re-read it.
- **The two sources need different credentials and have different failure modes.** Granola auth
  and Drive auth die independently. Separate lanes mean one dead source degrades to
  "zero meetings from that source" instead of stalling the run.

The trade is the same as any fan-out: the step costs whatever the *slowest* source costs, and the
critic is a serial stage after it.

## What ships here

| Agent | Model | Source | Budget |
|---|---|---|---|
| `meeting-granola` | haiku | Granola meetings for the day | 12 calls |
| `meeting-gemini` | haiku | Drive "Notes by Gemini" docs | 14 calls |
| `meeting-critic` | sonnet | *(verify the merged draft)* | 16 calls |

Plus `references/meeting-contract.md` — one shared file both fetch agents read. That matters more
here than anywhere else in the template: the orchestrator dedupes the two sources against each
other by `match_key`, and that only works if both sides build it **identically**. Two inlined
copies of the contract would drift, and the symptom would be silent duplicate meetings rather
than an error.

## Adding a second source is the actual upgrade

The default skill reads Granola only. If your team also uses Google Meet, `meeting-gemini` covers
meetings Granola never saw — and in practice the two overlap only partially, so a Granola-only
run quietly misses days.

If you use neither Drive nor Google Meet, drop `meeting-gemini` and run the fan-out with one
source plus the critic. The contract does not care how many lanes there are.

## On `granola_api.py`

The default skill documents a `granola_api.py fetch` path. In at least one deployment that
returned **HTTP 403** (verified 2026-08-02) while the Granola MCP tools kept working against the
same account. `meeting-granola` therefore prefers the MCP tools and treats the HTTP path as a
fallback.

If `granola_api.py` works for you, nothing here breaks it — but if you hit a 403, that is the
known cause and the MCP tools are the fix, not a new token.

## The two rules that carry the weight

**1. Spawn the source agents in a single message.** They share no data, so they run concurrently.
One per message serializes the whole step.

**2. `## Not read` is never optional.** Any meeting a fetch agent skipped, could not open, or
dropped for budget must be listed. Otherwise a half-covered day is indistinguishable from a quiet
one, and the critic's coverage check — which compares the source lists against the draft — is the
only thing that catches it.

## Why the critic exists

It writes into two files that are hard to un-write: an append-only history, and the user's real
task list. A fabricated action item there becomes a commitment they believe they made.

Its highest-value checks are the two that are easy to get wrong and impossible to spot later:

- **Owner accuracy.** An action the source assigns to someone else, silently reassigned to the
  user, lands in their task list and stays there.
- **Decisions that were only discussions.** Summaries state "we decided X" far more confidently
  than meetings actually decide. That is where fabrication concentrates.

It also greps the task file for each action's *substance* before writing, so a re-run does not
duplicate what is already tracked.
