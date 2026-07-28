# Active Tasks

Your task list. The dashboard reads and writes this file — edit it here or in the
Tasks tab, both work. The structure below is what the parser expects:

- `## 🔭 Standing / Carrying` holds the backlog, split into `###` groups. The four
  groups below are the Eisenhower quadrants; rename them to whatever you prefer.
- Task lines are `- ☐ text`, with `✅` done, `🏗️` in progress, `❌` dropped.
- Optional trailing meta: `[@label]` chips (defined in `../team/task-labels.json`)
  and an age like `— 3d`.
- `## 📌 Today — YYYY-MM-DD` holds today's plan. `**Top 3:**` must be written
  exactly like that (numbered list under it) or the Top 3 silently won't render.

## 🔭 Standing / Carrying

### 🔥 Urgent + Important

- ☐ Replace this with something you actually need to do today

### 🎯 Important, Not Urgent

- ☐ The work that matters but has no deadline pressure

### ⚡ Urgent, Not Important

- ☐ Interruptions and requests you could delegate

### 🌱 Neither — someday

- ☐ Ideas worth keeping, not worth starting

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
