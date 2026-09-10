import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerPullRequestsRoutes } from '@asucregonzalez/section-pull-requests/server';
import { registerTasksRoutes } from '@asucregonzalez/section-tasks/server';
import { registerJournalRoutes } from '@asucregonzalez/section-journal/server';
import { registerMeetingsRoutes } from '@asucregonzalez/section-meetings/server';
import { registerClaudeSessionsRoutes } from '@asucregonzalez/section-claude-sessions/server';
import { registerRoadmapRoutes } from '@asucregonzalez/section-roadmap/server';

/**
 * The API server. Each installed section with a backend gets its own router and a
 * SectionContext telling it where your content and its state live.
 *
 * To add a section's API: import its `register…Routes` and mount it the same way.
 */

const PORT = Number(process.env.PORT ?? 4320);
const app = express();
app.use(express.json({ limit: '1mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const ctx = {
  // Your markdown workspace: tasks/active.md, tasks/journal.md, meetings/*.md,
  // team/task-labels.json. Defaults to the content/ folder in this repo — set
  // CONTENT_ROOT to point at your own notes folder instead.
  contentRoot: process.env.CONTENT_ROOT
    ? path.resolve(process.env.CONTENT_ROOT)
    : path.join(ROOT, 'content'),
  // Section runtime state (PR projects, squads, saved checkpoints). Gitignored.
  dataDir: path.join(ROOT, '.data'),
  env: process.env,
  gwsConfigDir: process.env.GOOGLE_WORKSPACE_CLI_CONFIG_DIR ?? '',
};

// Identity, not just liveness. `start-stack.sh` used to accept any server that
// answered on the API port — so with another Command Center already on 4320 it
// reported "the stack is up" while THIS server had died with EADDRINUSE, and the
// dashboard silently rendered the other workspace's tasks. Returning contentRoot
// lets the caller check it reached the right app.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'command-center', contentRoot: ctx.contentRoot, pid: process.pid });
});

console.log(`[command-center] content root: ${ctx.contentRoot}`);

// --- sections ---------------------------------------------------------------
// Pull requests starts with no projects; add your squads from its own UI. To
// pre-seed them in code, pass { seedProjects, seedSquads, displayNames } as a
// third argument — written to .data on first run only.
//
// `defaultOrganizations` is the GitHub org(s) a project falls back to when it
// names none. The package deliberately ships none: an org baked into a shared
// package doesn't fail visibly, it quietly queries someone else's GitHub and
// returns their PRs. Read from the same VITE_GITHUB_ORGS that src/App.tsx uses,
// so the org the settings UI suggests is the org this server actually queries.
// Leave it unset and a PR fetch says "no organizations configured" rather than
// looking like an empty queue.
const githubOrgs = (process.env.VITE_GITHUB_ORGS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const prRouter = express.Router();
registerPullRequestsRoutes(prRouter, ctx, { defaultOrganizations: githubOrgs });
app.use(prRouter);

const routers = [
  registerTasksRoutes,
  registerJournalRoutes,
  registerMeetingsRoutes,
  // Reads content/team/roadmaps/*.json — one file per squad, discovered from
  // disk. With none there the tab offers to create the first one.
  registerRoadmapRoutes,
  // Reads ~/.claude/sessions and ~/.claude/projects — nothing in this repo. It
  // reports no sessions rather than failing when those are absent or unreadable.
  registerClaudeSessionsRoutes,
];

for (const register of routers) {
  const router = express.Router();
  register(router, ctx);
  app.use(router);
}

// Serve the built SPA in production (`pnpm build && pnpm start`).
app.use(express.static(DIST));
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[command-center] http://localhost:${PORT}`);
});
