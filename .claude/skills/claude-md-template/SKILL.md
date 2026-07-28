---
name: claude-md-template
description: "Use on every write to a file named CLAUDE.md -- create or modify, even a one-line tweak, in any repository."
tags: [claude-md, template, documentation, structure, hierarchy]
---

# CLAUDE.md Template


Enforces a consistent shape across every `CLAUDE.md` in a project. Three variants exist — **Root**, **Intermediate**, **Leaf** — picked by filesystem position. The skill auto-fixes missing required sections without asking for confirmation, and preserves anything the user added on top.

The goal is a coherent, navigable hierarchy of `CLAUDE.md` files where each level explains itself and points to the next. The templates capture the minimum spine that makes that hierarchy work; on top of that, any project is free to add custom sections (Role, Preferences, Knowledge Areas, Operating Rules, etc.).

**Scope:** this skill applies only to files named exactly `CLAUDE.md`. Other agent-instruction filenames (`AGENTS.md`, `GEMINI.md`, `.cursorrules`, etc.) are out of scope — surface the mismatch but do not auto-apply this template. If multiple `CLAUDE.md` files are being touched in a single turn, run the skill for each.

## Step 1 — Detect the variant

Given the path of the `CLAUDE.md` being edited (call it `P`):

1. **Root** — no ancestor directory above `P` contains a `CLAUDE.md` file (within the same repo or workspace). `P` is the entry-point map for the whole project.
2. **Intermediate** — at least one descendant directory of `P`'s parent contains its own `CLAUDE.md`. `P` is a navigation node.
3. **Leaf** — neither of the above. `P` is a terminal node.

Walk the filesystem to decide. A useful pattern:

- For Root vs not-Root: check whether any directory between `P`'s parent and the repo root contains a `CLAUDE.md`.
- For Intermediate vs Leaf: list child directories of `P`'s parent and check for `CLAUDE.md` inside each (and one level deeper if needed).

### Tie-breakers and respected signals

- A file that already contains a `Parent: [...](...)` line directly under the H1 is **never** Root.
- A file that already has a `## Deep-Dive Navigation` table linking to existing child `CLAUDE.md` files is at least **Intermediate**, even if those children are sparse.
- If the existing file's shape strongly contradicts the filesystem signal (e.g., a leaf with no children but linking to planned child CLAUDE.mds), **trust the existing shape** and do not restructure.

## Step 2 — Detect code project vs knowledge node (Leaf only)

For Leaf files, decide whether this directory represents a **code project** by checking for a build/runtime manifest in the directory or any descendant:

`package.json`, `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py`, `Cargo.toml`, `go.mod`, `Gemfile`, `pom.xml`, `build.gradle`, `composer.json`, `Makefile` (with build/test targets).

- Manifest present → **code leaf**. The full Leaf spine applies (Stack, Architecture, Key Files, Conventions, Running).
- No manifest → **knowledge leaf**. Only the H1, Parent link, and overview section are required. Stack / Architecture / Running are not enforced — knowledge nodes use whatever shape fits the content (e.g., `## Key Files & People`, `## Conventions`, `## Links`).

## Step 3 — Apply the spine

The three reference templates are bundled under `templates/`. Each is the original AGENTS-style template with `AGENTS.md` swapped to `CLAUDE.md` everywhere. Use them as authoritative reference, **not** as full file rewrites — extras the user added are protected.

### Root spine — required sections

1. `# [Project Name]` — H1.
2. `## How to Use This File` — the mandatory protocol for using the hierarchy.
3. `## What Is This Project` (or `## What Is This Workspace` / `## What Is This Repository` — any equivalent overview heading).
4. `## Deep-Dive Navigation` — table with columns `Path | Description | Keywords` listing child `CLAUDE.md` files.

Full reference: [templates/root.md](templates/root.md).

### Intermediate spine — required sections

1. `# [Module/Domain Name]` — H1.
2. `Parent: [../CLAUDE.md](../CLAUDE.md)` — line directly under the title.
3. `## What Lives Here` — directory overview. Ideally followed by a sub-modules table with columns `Directory | Role | Status`.
4. `## Deep-Dive Navigation` — table with columns `Path | Description | Keywords` listing child `CLAUDE.md` files.

Full reference: [templates/intermediate.md](templates/intermediate.md).

### Leaf spine — required sections

Always required:

1. `# [App/Service/Package Name]` — H1.
2. `Parent: [../CLAUDE.md](../CLAUDE.md)` — line directly under the title.
3. `## What This [App/Service] Does` (or `## What Lives Here` for knowledge leaves) — concise overview.

Additionally required for **code leaves**:

4. `## Stack` — table with columns `Concern | Technology`.
5. `## Architecture / Directory Layout` — ASCII tree or diagram of the directory.
6. `## Key Files & Components` — table with columns `File / Component | Purpose`.
7. `## Conventions` — local conventions for file naming, styling, patterns.
8. `## Running` — exact commands to run, build, or test the app/service.

Full reference: [templates/leaf.md](templates/leaf.md).

## Step 4 — Auto-fix structural gaps

Apply fixes automatically, without asking for confirmation. The three cases:

**Brand new or empty file.** Generate it from the appropriate template. Substitute placeholders with real values where you have them (project name, parent path, child CLAUDE.md links you can discover from the filesystem). Leave the remaining `[bracketed instructions]` so the user knows what to fill in.

**File exists but is missing required sections.** Insert each missing section at its natural position, using `[bracketed placeholders]` for the body. Natural positions:

- H1 → first line if missing.
- `Parent:` line → immediately under the H1 (intermediate/leaf only).
- Overview section (`How to Use This File`, `What Is This Project`, `What Lives Here`, `What This X Does`) → right after the H1 / Parent line.
- `Deep-Dive Navigation` → after the overview, before any custom sections.
- Code-leaf sections (`Stack`, `Architecture`, etc.) → after the overview, in the order shown in [templates/leaf.md](templates/leaf.md).

**File already satisfies the spine.** Do nothing structural. Just make the user's requested edit.

### Protections that must always hold

- **Never delete or rewrite existing custom sections.** Sections like `## Role`, `## Preferences`, `## Knowledge Areas`, `## Operating Rules`, `## Management Lenses`, `## Key Files & People`, `## Links`, `## Local Conventions`, etc. are valid extras and must be preserved verbatim.
- **Never reorder sections that already exist.** Only insert missing ones.
- **Never replace user-written prose with template placeholders.** If a required section exists but has thin content, leave it.
- **Never strip the `Parent:` line** even if filesystem detection suggests Root — that signal is intentional.

After auto-fix, briefly tell the user which sections were inserted, e.g. _"Added a missing `## Deep-Dive Navigation` skeleton with a placeholder row — fill it in with the child CLAUDE.md links."_

## Step 5 — Filename swap is already done

The bundled templates already use `CLAUDE.md` everywhere. Do not paste content from the templates that still references `AGENTS.md`; that swap is the whole point of bundling them.

If the user's project happens to use a different filename convention (`AGENTS.md`, `GEMINI.md`, …), flag the mismatch and stop:

> This skill targets `CLAUDE.md`. Your repo appears to use `AGENTS.md` — let me know if you want me to apply the same shape there, but I won't auto-rewrite without confirmation.

## Step 6 — Link and Markdown conventions

Any content the skill inserts must follow these rules:

- Standard Markdown links only: `[label](relative/path.md#anchor)`. Never Obsidian-style `[[wikilinks]]`.
- Section anchors are `#kebab-case-of-the-heading`.
- Tables use the exact column headers from the template (`Path | Description | Keywords`, `Directory | Role | Status`, `Concern | Technology`, etc.) so downstream tooling can rely on them.
- Use relative paths for child `CLAUDE.md` links (`memory/CLAUDE.md`, not absolute paths).

## Templates

- [Root](templates/root.md) — top-level project / workspace entry point.
- [Intermediate](templates/intermediate.md) — folder with child `CLAUDE.md` files.
- [Leaf](templates/leaf.md) — terminal folder (app / service / package / knowledge node).
