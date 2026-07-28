# Command Center — starter

Your own dashboard, running only the sections you install. Nothing here reads
anyone else's data: your notes live in this folder, and the tokens are yours.

Four sections are wired up out of the box:

| Tab | What it does | Reads / writes |
|---|---|---|
| 🏠 Home | Empty page, yours to fill | — |
| 🔀 Pull requests | Per-squad PR checkpoints from GitHub, Slack channel signals, and a ready-to-paste Slack draft | `.data/` |
| ✅ Tasks | Eisenhower-quadrant backlog + a Today block | `content/tasks/active.md` |
| 📓 Journal | Per-day journal | `content/tasks/journal.md` |
| 📅 Meetings | Meeting notes by bucket, with live action-item checkboxes and archiving | `content/meetings/` |

## Setup (~2 minutes)

**1. Install.** The section packages are public on npm — no token, no registry
config, nothing to authenticate:

```bash
pnpm install
```

> **Upgrading from an early copy of this template?** Delete any `.npmrc` in this
> folder first. An earlier version told you to point the `@asucregonzalez` scope at
> GitHub Packages; the packages now live on npm, and a leftover `.npmrc` sends the
> install to the wrong registry and 404s. `.npmrc` is gitignored, so `git pull`
> can't remove it for you:
>
> ```bash
> rm -f .npmrc && pnpm install
> ```

**2. Configure.**

```bash
cp .env.example .env
```

- `GITHUB_TOKEN` — **required** by Pull requests. Classic token with `repo` scope,
  so it can read PRs in the orgs you track.
- `SLACK_BOT_TOKEN` — optional. Only for channel signals and posting the draft.
- `VITE_OWNER_NAME` — your name as it appears in an `Owner:` field, so Meetings can
  split action items into yours vs everyone else's.

Tasks, Journal and Meetings need no tokens at all — they're just your markdown.

**3. Run.**

```bash
pnpm dev          # or: make dev
```

`make` on its own lists every shortcut — `make setup` does the one-time bootstrap
(isolated Google Workspace config dir + local settings), `make run` launches Claude
with this workspace's environment.

Open http://localhost:5273. The API runs on :4320 and the dev server proxies
`/api` to it.

Pull requests starts with **no projects** — add your first squad from its own UI (a
name plus the GitHub logins to track). Tasks, Journal and Meetings start from the
seeded files in `content/`, which double as format documentation.

## The skills

`.claude/skills/` ships eight Claude Code skills. These five keep the dashboard's
data current, so you're not hand-editing markdown:

| Skill | What it does |
|---|---|
| `task-management` | Creates and edits tasks in `content/tasks/active.md`, enforcing one action per task |
| `daily-briefing` | Reconciles yesterday, gathers calendar + mail + Slack + PR queue + backlog, proposes today's Top 3, writes the Today block and archives yesterday to the journal |
| `meeting-processor` | Pulls yesterday's meetings from Granola into `content/meetings/`, and their action items into your task list |
| `sync-meetings` | Same, but from a Google Drive folder — use whichever matches where your notes live |
| `google-workspace-cli` | Reference for the `gws` CLI, which the two Google-backed skills above rely on |

**Each needs a few blanks filled in before first use** — your GitHub login, Slack
member ID, Granola folder names or a Drive folder id. Every skill says so at the
top. A skill whose tool you haven't authenticated skips that source and tells you,
rather than making something up.

The two meeting skills are the ones you'll hit first: both start with **no source
configured**, so they'll ask instead of syncing. That's deliberate — a bucket is a
decision about how you organise your work, not something to guess. Answer with a
Drive folder id (`sync-meetings`), your Granola folder names (`meeting-processor`),
or "neither, I'll write notes by hand" — the Meetings tab reads
`content/meetings/*.md` either way.

Ask for them in plain language ("what's my plan today?", "process yesterday's
meetings") or invoke directly with `/daily-briefing`.

### A second brain, if you want one

Four more skills turn `content/memory/` into a wiki that compounds:

| Skill | What it does |
|---|---|
| `wiki` | Drop a document in `content/sources/`, ask to ingest it, and it becomes linked pages in `content/memory/`. Also queries and lints the knowledge base |
| `memory-claude-md-sync` | Fires on every wiki write so the navigation hub never drifts from reality |
| `claude-md-template` | Keeps every `CLAUDE.md` to one shape, so the hierarchy stays navigable |
| `/weekly-done-cleanup` | Prunes completed tasks out of the backlog into `content/tasks/done-archive.md`, keeping ones that still give context |

And these are general-purpose, nothing to do with the dashboard:

| Command / skill | What it does |
|---|---|
| `/setup` | Walks you through first-time setup — identity, placeholders, isolated Google auth, git history |
| `/wiki-ingest` | Ingest one document into the wiki, proposing what to write before writing it |
| `/grill-me` | Interrogates a plan branch by branch until the decisions are actually resolved |
| `/compact-session` | Captures a long chat's context into notes plus a resume prompt for a fresh session |
| `create-presentation` | Builds a Fever-brand deck in Google Slides — brand kit and the Slides-API gotchas already solved |

`content/memory/` ships empty with just its hub file. Nothing is pre-populated — it
becomes useful only as you feed it.

### Bootstrap scripts

`.claude/scripts/setup/` holds the one-time setup machinery, all parameterized:

| Script | Does |
|---|---|
| `apply-placeholders.sh` | Substitutes `{{NAME}}` / `{{EMAIL}}` / `{{GH_HANDLE}}` across the template |
| `ensure-gws-config-dir.sh`, `verify-gws.sh` | Creates and checks an **isolated** Google Workspace config dir, so this assistant's auth never collides with anything else |
| `generate-makefile.sh` | Writes a `makefile` whose `run` target launches Claude with the right env |
| `init-settings-local.sh` | Seeds `.claude/settings.local.json` |
| `fresh-git-init.sh` | Wipes template history for a clean first commit — **destructive**, run deliberately |

`CLAUDE.md` documents the workspace conventions all of these follow — worth reading
once.

## Recommended: rtk

[rtk](https://github.com/rtk-ai/rtk) is a CLI proxy that compresses command output
*before* the agent reads it — a single Rust binary, Apache-2.0. It's the cheapest
efficiency win available here, because every oversized tool result gets re-read on
every subsequent turn.

```bash
brew install rtk       # or: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g            # registers a global PreToolUse hook + ~/.claude/RTK.md
                       # then restart Claude Code
rtk init --show        # verify
```

Measured on this project's own repo:

| Command | Raw | Via rtk |
|---|---|---|
| `ls -la` | 1615 B | 256 B (−84%) |
| `git log -n 20` | 24.2 kB | 6.6 kB (−73%) |
| `git status` | 636 B | 282 B (−56%) |
| `git diff --stat` | 414 B | 413 B (−0%) |

Read the claims precisely, because the honest version is less dramatic than "90%":

- It compresses **bash output**, which is one input among your prompt, the system
  prompt and the conversation history — and input is only part of the bill. The
  reduction dilutes at each step.
- Its token figures are `bytes / 4` estimates; the **percentages** are trustworthy,
  the absolute token counts are not.
- Already-terse commands gain nothing, as the `git diff --stat` row shows.
- **`Read`, `Grep` and `Glob` bypass it** — the hook only intercepts the Bash tool.
  For big files, reach for `rtk read` / `rtk grep`, or a ranged `Read`.

Install it **globally** (`-g`), not as a hook in this repo: a committed hook would
fail for anyone who hasn't installed the binary.

## Your content

`content/` is a plain folder of markdown you can edit directly, in the app, or
both — the sections read and write the same files.

```
content/
├─ tasks/active.md         ← Tasks tab. Standing quadrants + a Today block.
├─ tasks/journal.md        ← Journal tab. One `## YYYY-MM-DD` entry per day.
├─ team/task-labels.json   ← the [@label] chips Tasks can put on a task
├─ memory/CLAUDE.md        ← the wiki's hub (starts empty)
├─ sources/                ← drop documents here for /wiki-ingest
└─ meetings/
   ├─ example.md           ← 2 example meetings, with action items owned by you and others
   ├─ example-planning.md  ← a second bucket, so you can see the grouping
   └─ archive/             ← notes archived from the UI (one example inside)
```

**Want to see the Pull requests tab populated too?** It needs no token for that:

```bash
cp -R .data.example .data && make dev
```

That gives you one example squad and a **saved checkpoint** — PRs grouped by state,
a Slack signal, and a ready-to-paste draft — rendered from stored JSON, so there are
no GitHub calls at all. Delete `.data/` when you want to add your own squad; see
`.data.example/README.md`.

Two formats are strict, and the files show both:

- **Journal** entries need `## YYYY-MM-DD` headings. Any other heading is ignored.
- **Tasks** needs `**Top 3:**` written exactly like that, with a numbered list
  under it, or the Top 3 silently won't render.

Already keep notes somewhere else? Point `CONTENT_ROOT` at that folder in `.env`
and the sections read it instead — it just needs the same layout.

## Adding another section

```bash
pnpm add @asucregonzalez/section-<name>
```

Then two edits:

1. `src/sections.ts` — import the descriptor and add it to the array (this drives
   the tab bar).
2. `server/index.ts` — if the section has a backend, add its `register…Routes` to
   the `routers` list.

## Layout

| Path | What it is |
|---|---|
| `makefile` | Shortcuts — `make` lists them |
| `CLAUDE.md` | Workspace map + the conventions the skills and dashboard share |
| `.claude/skills/` | The skills that maintain your content and wiki |
| `.claude/scripts/setup/` | One-time bootstrap scripts |
| `content/memory/` | Your wiki — starts empty |
| `src/sections.ts` | The one file that decides which sections you run |
| `src/HomeView.tsx` | The Home page |
| `src/App.tsx` | The shell: tab bar + the active section's view + host config |
| `server/index.ts` | Express server; mounts each section's routes |
| `tailwind.config.js` | Loads the shared theme preset, and scans installed sections for classes |
| `content/` | Your markdown (see above) |
| `.data/` | Pull-requests state: projects, squads, saved checkpoints — gitignored |
| `.data.example/` | Committed example of the above — `cp -R .data.example .data` to see it |

## Gotchas

- **`src/index.css`**: the `@import '@asucregonzalez/theme/base.css'` must stay
  above the `@tailwind` directives. postcss-import only inlines `@import` at the
  top of a file, so moving it down silently drops every component class and
  sections render half-styled.
- **`tailwind.config.js`**: keep the `./node_modules/@asucregonzalez/*/dist/**/*.js`
  content glob. Sections ship compiled markup, and Tailwind purges any class it
  can't see.
- **No "Regenerate" buttons?** Expected. Those re-run a Claude skill on the host;
  this app sets `refreshEnabled: false` in `src/App.tsx`, so sections hide them
  rather than offer a button that can't work. If you build your own
  `/api/refresh/<skill>` route, flip it to `true`.
- **Sections render unstyled?** You're missing `presets: [ccPreset]` or one of the
  two points above.
- **`pnpm install` edited `pnpm-workspace.yaml`?** Expected, and harmless. pnpm 11
  quarantines very recently published packages as a supply-chain precaution; when
  a section release is newer than that window it adds the versions to
  `minimumReleaseAgeExclude` and proceeds. Commit it or discard it, either is fine.
