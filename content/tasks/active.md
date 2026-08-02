# Active Tasks

Your task list. The dashboard reads and writes this file — edit it here or in the
Tasks tab, both work. The structure below is what the parser expects:

- `## 🔭 Standing / Carrying` holds the backlog, split into `###` groups. The four
  groups below are the Eisenhower quadrants; rename them to whatever you prefer.
- Task lines are `- ☐ text`, with `✅` done, `🏗️` in progress, `❌` dropped.
- Leading markers in the title: a priority — `[P0]` now, `[P1]` this cycle, `[P2]`
  later, `[P3]` nice-to-have — then a work type from `../../src/work-types.ts`
  (`/setup` picked that set for your role).
- Optional trailing meta: `[@label]` chips (defined in `../team/task-labels.json`)
  and an age like `— 3d`.
- `## 📌 Today — YYYY-MM-DD` holds today's plan. `**Top 3:**` must be written
  exactly like that (numbered list under it) or the Top 3 silently won't render.

## 🔭 Standing / Carrying

### 🔥 Urgent + Important

- ☐ **[P0] Replace this with something you actually need to do today** — 0d

### 🎯 Important, Not Urgent

- ☐ **[P1] The work that matters but has no deadline pressure** — 0d

### ⚡ Urgent, Not Important

- ☐ **[P2] Interruptions and requests you could delegate** — 0d

### 🌱 Neither — someday

- ☐ **[P3] Ideas worth keeping, not worth starting** — 0d

## 📌 Today — 2026-01-01

**Top 3:**

1. First thing that must happen today
2. Second thing
3. Third thing

**🚫 Do NOT do today:**

- Something you're deliberately not touching

**📋 Other priorities:**

- Smaller items, if any

**✅ What landed:**

- Filled in as you go
