# [App/Service/Package Name]

Parent: [../CLAUDE.md](../CLAUDE.md)

## What This [App/Service] Does

[Provide a concise explanation of what this specific application or service does. What is its main responsibility? How does it fit into the broader system?]

## Stack

| Concern | Technology |
|---------|------------|
| [e.g., Framework] | [e.g., Next.js 16 / FastAPI] |
| [e.g., UI / Runtime] | [e.g., React 19 / Python 3.11] |
| [e.g., State / DB] | [e.g., Zustand / PostgreSQL] |

## Architecture / Directory Layout

[Provide an ASCII directory tree or an architecture diagram to help the agent understand the mental model of this specific leaf node.]

```text
src/
├── app/               → [Description]
├── features/          → [Description]
└── lib/               → [Description]
```

## Key Files & Components

[List the most important files, components, hooks, or modules that an agent should be aware of when working in this directory.]

| File / Component | Purpose |
|------------------|---------|
| `[filename]` | [What it does and why it's important] |
| `[filename]` | [What it does...] |

## Conventions

[List local conventions that apply specifically to this leaf node. This prevents agents from breaking established patterns.]

- **File naming**: [e.g., PascalCase for components, camelCase for hooks]
- **Styling**: [e.g., Tailwind utility classes]
- **Patterns**: [e.g., One component per file, co-located with its feature]

## Running

[Provide the exact commands needed to run, build, or test this specific application/service.]

```bash
cd [path/to/this/dir]
npm run dev     # Starts development server
npm run build   # Production build
```
