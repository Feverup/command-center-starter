# Example section data

`.data/` holds the Pull requests section's runtime state — your projects, squads and
saved checkpoints — and it's gitignored, because it's yours.

This folder is a **committed example** so you can see a populated dashboard before
connecting anything real. To use it:

```bash
cp -R .data.example .data && make dev
```

The Pull requests tab then shows a full checkpoint — PRs grouped by state, a Slack
signal, and a ready-to-paste draft — with **no GitHub token and no API calls**,
because a checkpoint is just saved JSON.

When you're ready for your own squad: delete `.data/`, restart, and add a project
from the tab's own UI. Or edit `projects.json` directly — the shape is right here.
