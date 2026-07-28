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

## Setup (~5 minutes)

**1. Authenticate to the package registry.** The sections are private packages, so
you need a GitHub token that can read them:

```bash
cp .npmrc.example .npmrc
# Create a classic token with ONLY the `read:packages` scope at
# https://github.com/settings/tokens  — then:
export GITHUB_PACKAGES_TOKEN=ghp_xxx        # add to ~/.zshrc to keep it
```

**2. Install.**

```bash
pnpm install
```

**3. Configure.**

```bash
cp .env.example .env
```

- `GITHUB_TOKEN` — **required** by Pull requests. Classic token with `repo` scope,
  so it can read PRs in the orgs you track.
- `SLACK_BOT_TOKEN` — optional. Only for channel signals and posting the draft.
- `VITE_OWNER_NAME` — your name as it appears in an `Owner:` field, so Meetings can
  split action items into yours vs everyone else's.

Tasks, Journal and Meetings need no tokens at all — they're just your markdown.

**4. Run.**

```bash
pnpm dev
```

Open http://localhost:5273. The API runs on :4320 and the dev server proxies
`/api` to it.

Pull requests starts with **no projects** — add your first squad from its own UI (a
name plus the GitHub logins to track). Tasks, Journal and Meetings start from the
seeded files in `content/`, which double as format documentation.

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
