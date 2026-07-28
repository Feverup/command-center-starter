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
pnpm dev
```

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

## Your content

`content/` is a plain folder of markdown you can edit directly, in the app, or
both — the sections read and write the same files.

```
content/
├─ tasks/active.md      ← Tasks tab. Standing quadrants + a Today block.
├─ tasks/journal.md     ← Journal tab. One `## YYYY-MM-DD` entry per day.
├─ team/task-labels.json ← the [@label] chips Tasks can put on a task
└─ meetings/
   ├─ example.md        ← one file per bucket; `### YYYY-MM-DD — Title` per note
   └─ archive/          ← notes archived from the UI
```

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
