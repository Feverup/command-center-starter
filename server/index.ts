import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerPullRequestsRoutes } from '@asucregonzalez/section-pull-requests/server';
import { registerTasksRoutes } from '@asucregonzalez/section-tasks/server';
import { registerJournalRoutes } from '@asucregonzalez/section-journal/server';
import { registerMeetingsRoutes } from '@asucregonzalez/section-meetings/server';

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

console.log(`[command-center] content root: ${ctx.contentRoot}`);

// --- sections ---------------------------------------------------------------
// Pull requests starts with no projects; add your squads from its own UI. To
// pre-seed them in code, pass { seedProjects, seedSquads, displayNames } as a
// third argument — written to .data on first run only.
const routers = [
  registerPullRequestsRoutes,
  registerTasksRoutes,
  registerJournalRoutes,
  registerMeetingsRoutes,
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
