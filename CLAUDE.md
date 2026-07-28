# Command Center Starter

## How to Use This File

Read this file first — it maps the workspace and names the conventions the
dashboard depends on. Then follow [Deep-Dive Navigation](#deep-dive-navigation) to
whatever you're working on.

Two things in here are **strict formats**, not style preferences. Break either and
the dashboard silently stops showing the data:

- `content/tasks/journal.md` entries need a bare `## YYYY-MM-DD` heading.
- The Today block's Top 3 needs the exact heading `**Top 3:**` followed by a
  numbered list.

Don't start with broad searches. The map below already says what exists and where.

## What Is This Project

Your personal Command Center: a small dashboard shell plus the sections you chose
to install, and a set of Claude skills that keep its data current.

The dashboard reads and writes plain markdown in `content/`, so you can edit your
tasks, journal and meeting notes in the app, in your editor, or through a skill —
all three touch the same files, and git is the safety net.

| Tab | Reads / writes |
|---|---|
| Home | — |
| Pull requests | `.data/` (projects, squads, saved checkpoints) |
| Tasks | `content/tasks/active.md` |
| Journal | `content/tasks/journal.md` |
| Meetings | `content/meetings/` |

## Deep-Dive Navigation

No child `CLAUDE.md` files yet. The places to look:

| Path | Description | Keywords |
|------|-------------|----------|
| [README.md](README.md) | Setup, tokens, adding a section, gotchas | install, setup, tokens, sections, tailwind |
| [.claude/skills/](.claude/skills/) | The skills that maintain this workspace | skills, briefing, tasks, meetings |
| [content/](content/) | Your markdown — the seeded files document their own formats | tasks, journal, meetings, labels |
| [src/sections.ts](src/sections.ts) | The single list deciding which tabs you run | sections, tabs, registry |
| [server/index.ts](server/index.ts) | Express server; mounts each section's API | api, routes, content root |

## Skills

| Skill | Use it for |
|---|---|
| `task-management` | Creating or editing any task in `content/tasks/active.md` |
| `daily-briefing` | The morning picture: calendar, mail, PRs, backlog → today's Top 3 |
| `meeting-processor` | Pull yesterday's meetings from Granola into `content/meetings/` |
| `sync-meetings` | The same, from a Google Drive folder instead |
| `google-workspace-cli` | Driving the `gws` CLI (Drive, Docs, Sheets, Gmail, Calendar) |

Each skill needs setting up for you before first use — your GitHub login, Slack ID,
Granola folders or Drive folder id. They say so at the top; fill in the blanks.
Skills that depend on a tool you haven't authenticated skip that source and tell
you, rather than inventing data.

## Conventions

- **Tasks are atomic** — one independently-checkable action per line, including in
  the Today Top 3. A shared meeting or theme doesn't justify bundling.
- **Today ↔ Standing are the same tickets.** Build the Top 3 by selecting existing
  Standing items verbatim, not by writing a summary of them. Closing one closes
  its twin in the same edit.
- **The Top 3 is deliverables, never meetings.** If a meeting matters, the task is
  its *prep*.
- **External trackers own their issues.** If a task lives in Jira, Linear or GitHub
  Issues, write through that tracker's API — never edit a local mirror.
- **Never put credentials or PII in `content/`.** Reference a message or ticket id
  instead. These files are git-tracked.

## Where your data lives

| Path | What | Shared with anyone? |
|---|---|---|
| `content/` | Your tasks, journal, meeting notes | No |
| `.data/` | Section runtime state | No — gitignored |
| `.env` | Your tokens | No — gitignored |

The installed `@andreasucreg/*` packages are code only. They read the paths this
app hands them and talk to no third party beyond the APIs you give tokens for.
