import { execFile } from 'node:child_process';

/**
 * Re-run a skill from the dashboard: `POST /api/refresh/<skill>` spawns a headless
 * `claude -p` in this repo, `GET /api/refresh/<skill>` reports how it went.
 *
 * This is what makes the Home page's "Run morning sync" button — and any section's
 * ↻ Regenerate button — do something. An app that doesn't mount these routes should
 * set `refreshEnabled: false` in `src/App.tsx` so the buttons hide instead of 404ing.
 *
 * Each click is a real Claude run: a couple of minutes and real token cost. Nothing
 * is queued — a second click while a skill is running returns the run in flight
 * rather than starting a rival copy of it.
 *
 * Requires the `claude` CLI on the host's PATH. Without it every job fails with a
 * message saying so; the skills still work when you run them yourself in Claude Code.
 */

// Fixed allowlist of skill → prompt. NEVER take the prompt from the request: only
// these keys are runnable, so a localhost endpoint can't be talked into running an
// arbitrary `claude -p`. Add a skill here before adding a button for it — a button
// whose key is missing renders fine and 400s on click, which reads as "the panel is
// wired" right up until someone presses it.
const SKILL_PROMPTS: Record<string, string> = {
  // Both of these write content/tasks/active.md, and the Home button fires them
  // concurrently — daily-briefing rewrites the file wholesale while meeting-processor
  // appends action items. Hence the re-read-before-write instruction in each prompt:
  // without it the briefing's rewrite silently drops whatever the meeting run added
  // between the briefing's first read and its write.
  'daily-briefing':
    'Run the daily-briefing skill for today. Run fully autonomously — do not ask any questions and do not wait for confirmation at any checkpoint; if a source is unreachable (Slack, Gmail, Calendar or a Granola/Drive connector may be unavailable in a headless run), record that lane as no-evidence, continue with the rest, and say plainly at the end which lanes were not covered — never write an unverified negative. Another headless run may be appending action items to content/tasks/active.md at the same time: re-read that file immediately before you write it and merge, never overwrite lines that appeared after your first read.',
  meetings:
    'Run the meeting-processor skill to pull the latest meetings from Granola into content/meetings/. Run fully autonomously — do not ask any questions; if Granola is unreachable, say so plainly and state which meetings were not covered rather than reporting success. Another headless run (daily-briefing) may be rewriting content/tasks/active.md at the same time: re-read that file immediately before appending action items, and never overwrite a Today or Standing block you did not see on your first read.',
};

// How long each skill gets before it's killed. Per-skill because the spread is
// real: a one-source sync is done in two minutes, while a briefing that fans out an
// agent per source and then verifies the result takes far longer.
//
// Err generous. A cap that fires just before a skill's only side effect burns the
// entire run — and these times vary with how much mail, chat and tickets there are
// to read, so a cap set at one observed duration will eventually cut a slower day
// short. The reference numbers: a seven-source briefing measured 24:34 and a
// Granola sync 14:55, and the caps below are roughly twice that. The
// `already running` guard above is what stops runs piling up; this only exists so
// a genuinely wedged run eventually releases its slot.
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const SKILL_TIMEOUT_MS: Record<string, number> = {
  'daily-briefing': 50 * 60 * 1000,
  meetings: 30 * 60 * 1000,
};

export interface RefreshJob {
  status: 'running' | 'done' | 'error';
  startedAt: number;
  finishedAt?: number;
  code?: number | null;
  /** Tail of the run's output — the only thing the UI can show you on a failure. */
  tail?: string;
}

const jobs: Record<string, RefreshJob> = {};

export function refreshableSkills(): string[] {
  return Object.keys(SKILL_PROMPTS);
}

export function getRefreshJob(skill: string): RefreshJob | null {
  return jobs[skill] ?? null;
}

export function startRefresh(
  skill: string,
  cwd: string,
): { ok: boolean; status?: RefreshJob; error?: string } {
  const prompt = SKILL_PROMPTS[skill];
  if (!prompt) return { ok: false, error: `unknown skill: ${skill}` };
  // Already running → hand back the run in flight. Two copies of the same skill
  // writing the same markdown is the one failure this endpoint can cause on its own.
  if (jobs[skill]?.status === 'running') return { ok: true, status: jobs[skill] };

  const job: RefreshJob = { status: 'running', startedAt: Date.now() };
  jobs[skill] = job;

  // `--permission-mode bypassPermissions` so the run never blocks on a prompt no one
  // is there to answer. It is why the allowlist above is the security boundary: this
  // spawn will do whatever the named skill does, unattended, in this repo.
  const timeoutMs = SKILL_TIMEOUT_MS[skill] ?? DEFAULT_TIMEOUT_MS;
  const child = execFile(
    'claude',
    ['-p', prompt, '--permission-mode', 'bypassPermissions'],
    { cwd, env: process.env, maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs },
    (err, stdout, stderr) => {
      job.finishedAt = Date.now();
      job.tail = `${stdout ?? ''}${stderr ?? ''}`.slice(-1500);
      job.status = err ? 'error' : 'done';
      job.code = err ? 1 : 0;
      // Say when WE killed it. A timed-out child is SIGTERMed before it prints
      // anything explaining itself, so the tail is whatever noise it happened to
      // have emitted — which reads as the cause and sends you debugging the skill
      // instead of this cap.
      if (err && (err as { killed?: boolean }).killed) {
        const mins = Math.round(timeoutMs / 60_000);
        job.tail = `timed out: killed after ${mins} min (SKILL_TIMEOUT_MS in server/refresh.ts). Partial output follows.\n${job.tail}`;
      }
    },
  );
  // `claude -p` waits ~3s for stdin it will never get from us, warns, and proceeds.
  // Closing it drops both the wait and a warning that otherwise sits at the top of
  // every job's tail looking like the error.
  child.stdin?.end();
  child.on('error', (e) => {
    job.status = 'error';
    job.finishedAt = Date.now();
    // Name the actual cause. ENOENT here means the CLI isn't installed, and the
    // raw message sends you looking at the skill instead of at your PATH.
    job.tail =
      (e as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'the `claude` CLI was not found on PATH — install Claude Code, or run this skill yourself instead'
        : `failed to spawn claude: ${e.message}`;
  });

  return { ok: true, status: job };
}
