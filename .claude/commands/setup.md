---
name: setup
description: >
  Interactive, agent-guided setup for this Personal Assistant. Walks the user
  through identity (name/email/GitHub), Google Workspace authentication in an
  isolated config dir, and makefile generation. Runs deterministic scripts from
  .claude/scripts/setup/ for everything that can be automated, and pauses to
  confirm anything that requires the user (OAuth flows, etc).
  Use this immediately after cloning the template.
---

# /setup — stand up this Personal Assistant

You are orchestrating a one-time setup flow that turns a fresh template clone into a personalized, running assistant. The user just cloned the template repo and started a Claude session in it. Your job is to interview them, run the scripts under `.claude/scripts/setup/`, and at the end leave them with a working `make run` command plus clear next steps.

## Principles

- **Favor determinism.** Every side effect goes through one of the scripts in `.claude/scripts/setup/`. Don't use Write/StrReplace/Edit to replicate what a script can do. Reserve direct file edits for things no script covers — in this flow that's only the optional task-label seed (step 3c) and any hand-tuning of `src/work-types.ts` the user asks for after seeing it.
- **Verify after each side effect.** If a script runs, read back the file(s) it touched and confirm the change took. If verification fails, abort (see "Error handling" below).
- **Track progress with `TodoWrite`.** Create the full todo list at the start of the flow, update status as you go. The user watches this to know where you are.
- **Ask one question at a time** unless a group of questions is genuinely atomic (e.g. "name AND email"). Use the `AskQuestion` tool for multi-choice, plain text for free-form answers.
- **Idempotency.** If `/setup` is re-run, detect completed state and offer to skip or re-run each step individually. Don't blindly redo everything.

## Error handling

On any non-zero exit from a setup script, STOP the flow. Report to the user:

1. Which step failed (e.g. "generate-makefile.sh")
2. The exact stderr the script emitted
3. The most likely fix (based on the script's error message)
4. Instruction to re-run `/setup` after fixing

Do NOT attempt automatic retry. Do NOT skip past the failing step. The user decides how to proceed.

## Flow

### 1. Greet and scope

Briefly explain what this command does (one paragraph). Warn that some steps (Google Workspace OAuth) happen outside the chat and you'll pause for the user to complete them in another terminal or app.

Immediately after greeting, create the initial todo list with these items:

- Profile: collect name, email, GitHub handle, role, goal, team, timezone, Slack
- Apply placeholders (substitute the profile tokens)
- Work types for their role (`src/work-types.ts`)
- Seed task labels (optional)
- Init local settings
- Google Workspace auth (optional, isolated config dir)
- GitHub account pin for `gh auth token` (optional)
- Generate makefile
- Fresh git history (optional)
- Print next steps

### 2. Profile

This is the step that decides how well everything else fits them, so don't rush
it. Ask in three small batches (each batch is one message; the items inside a
batch are atomic enough to ask together):

**Batch 1 — identity**
- Name
- Email
- GitHub username (optional — drives PR search in `daily-briefing`; accept empty)

**Batch 2 — situation.** Say plainly why you're asking: their role picks the work-type
buckets on the task board, and their goal becomes the tiebreaker the briefing uses
when ranking work.
- **Role.** Their own words ("Senior backend engineer", "EM for two squads"). Then
  map it to one of the preset keys by running
  `.claude/scripts/setup/apply-work-types.mjs --list` and offering the closest
  match with `AskQuestion`. **Confirm the mapping** — don't infer a manager from
  the word "lead", and don't infer seniority from tenure. If nothing fits, tell
  them you'll seed the closest and they can edit `src/work-types.ts` after.
- **Current goal** — the one outcome the next quarter is judged on, one sentence.
  If they give you three, ask which one wins when they conflict; the value of this
  field is that it's a tiebreaker, and a list can't break ties. If they genuinely
  don't have one, leave it empty rather than inventing something plausible.
- **Team / squad name** (optional).
- **Timezone** — offer the machine's (`date +%Z`, and `%z` for the offset) as the
  default, since it's usually right.

**Batch 3 — Slack** (optional, skip if they don't use it)
- Slack member ID (their profile → "Copy member ID"; looks like `U0123456789`)
- Channels worth scanning each morning, comma-separated with the `#`

Nothing here is load-bearing enough to block on: an empty value leaves its
placeholder token in place for later, and you'll tell them so at the end.

### 3. Apply placeholders

Run, with empty strings for anything they skipped:

```bash
.claude/scripts/setup/apply-placeholders.sh "<name>" "<email>" "<gh_handle_or_empty>" \
  ROLE="<role in their words>" \
  GOAL="<one-sentence goal>" \
  TEAM="<team>" \
  TIMEZONE="<tz>" \
  SLACK_ID="<Uxxxx>" \
  SLACK_CHANNELS="<#a, #b>"
```

Verify by grepping the repo for remaining `{{...}}` tokens outside `README.md` and
`.claude/scripts/` (those two reference the tokens on purpose). Report which tokens
are still unfilled and which file each is in — that list is the user's to-do, not a
failure. Confirm; don't dump the content back.

### 3b. Work types for their role

Run `.claude/scripts/setup/apply-work-types.mjs <role-key>` with the key confirmed
in step 2. It regenerates `src/work-types.ts` — ordinary TypeScript in their repo,
so it survives `pnpm update` and they can edit it afterwards.

Verify by reading back the generated file and showing them just the bucket list
(`📦 Ship · 🧪 Quality · …`). Ask whether those are the right buckets for how their
week actually splits. If not, either re-run with a different key or edit the file
directly — renaming a `tag` is safe here because there are no tasks yet.

### 3c. Seed task labels (optional)

Labels are the *project* axis (`[@billing]`, `[@platform]`), orthogonal to work
type. Offer to seed 3–5 from what they told you about their team and goal, written
to `content/team/task-labels.json` (`{"labels":[{"slug","name","color"}]}`, colours
from the Tailwind 500 range). Skip without argument if they'd rather add them in the
UI later — the Tasks tab has an editor.

### 4. Init local settings

Run `.claude/scripts/setup/init-settings-local.sh`. No verification needed — the script's output is self-explanatory.

### 5. Google Workspace (optional)

Ask whether to enable Google Workspace integration (Gmail, Calendar, Drive access via the `gws` CLI). If no, skip this step entirely.

If yes:

1. Check `gws` is installed: `command -v gws`. If not, print the install command (`npm install -g @googleworkspace/cli` plus Node and `gcloud` prerequisites) and abort this step with a message that the user should install gws then re-run `/setup`.
2. Ask the user for a config dir name. Suggest `gws-<nick>` where `<nick>` is the repo basename (e.g. `gws-command-center`). They can override.
3. Run `.claude/scripts/setup/ensure-gws-config-dir.sh <dir_name>`. Relay the `gws auth setup` command the script prints to the user. Tell them to run it in a separate terminal, complete the OAuth flow with the Google account this assistant should act as, and come back.
4. Wait for the user to confirm OAuth is done.
5. Run `.claude/scripts/setup/verify-gws.sh "$HOME/.config/<dir_name>"`. Show the authenticated email and ask the user to confirm it's the right account.
6. Remember `<dir_name>` for the makefile generation step. If the user skipped this whole section, treat it as empty.

### 6. GitHub account pin (optional)

Only applicable if the user provided a GitHub handle in step 2 AND is running multiple `gh` accounts. Detect this by running `gh auth status` and counting the number of logged-in accounts.

- If 0 or 1 `gh` accounts: skip. The default `gh` auth is fine.
- If 2+ accounts: show the user the list and ask which one this assistant should use. `make run` will bake `gh auth token --user <chosen>` into the env so the assistant's `gh` calls act as that user regardless of which is "active" in `gh` globally.

Remember the chosen user for the makefile generation step. If skipped, treat as empty.

### 7. The makefile

This template **already ships a `makefile`** — `make` lists its targets. Normally
there is nothing to do here: point the user at `make` and move on.

Only if they want the generated minimal variant instead (or need the `gh auth token
--user` pin baked in from step 6) run
`.claude/scripts/setup/generate-makefile.sh <nick> <gws_config_dir_or_empty> <gh_user_or_empty> --force`
— it refuses to clobber the shipped file without `--force`. Show them the diff
before overwriting, since the shipped one has more targets.

If step 5 chose a non-default gws config dir, the simpler fix is editing `NICK` at
the top of the existing makefile.

### 8. Fresh git history (optional)

Ask: "Wipe template git history and re-init? (recommended unless you're customizing this repo as a fork)". If yes, run `.claude/scripts/setup/fresh-git-init.sh`. Warn that this is destructive before running.

### 9. Next steps

Print a final summary block covering:

- How to launch: `make run`
- How to test the daily briefing: ask "what's on my plate today?"
- How to run the dashboard: `make dev` (web on :5273)
- What their profile now drives: role → work-type buckets in the Tasks tab, goal →
  the briefing's tiebreak. Both are editable — `src/work-types.ts` and the "Me"
  section of `CLAUDE.md` — and worth revisiting when either changes.
- Any placeholder token still unfilled, with the file to edit.

End by marking all todos complete and wishing them well. The user can exit the session with Ctrl-D and run `make run` to start their configured assistant.

## Notes for the agent

- The scripts are located relative to the repo root. Always invoke them as `.claude/scripts/setup/<name>.sh` — or `.mjs` for `apply-work-types`, which is Node so the role presets and the TypeScript it emits live in one file (the repo root is the working directory when `/setup` runs).
- The scripts use positional args, not env vars. Quote all args that could contain spaces. `apply-placeholders.sh` takes name/email/gh positionally and then any number of `TOKEN=value` pairs.
- Don't read the scripts' source unless debugging; trust their exit codes and stdout/stderr.
- If the user asks "what exactly is this going to do?", describe the flow above and the scripts involved, but don't overwhelm them with implementation details.
