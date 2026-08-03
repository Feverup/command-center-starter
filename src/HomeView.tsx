import useSWR from 'swr';
import { jsonFetch } from '@asucregonzalez/http';
import { useDashboardConfig, isOwnedByViewer } from '@asucregonzalez/ui';
import type { TasksResponse } from '@asucregonzalez/section-tasks';
import type { MeetingFile } from '@asucregonzalez/section-meetings';
import { destinations } from './sections';

/**
 * Home — a cockpit, not a landing page.
 *
 * It answers the two questions you open the dashboard to ask: how much is on my
 * plate, and what did I agree to in a meeting and not do yet. Everything below
 * those two numbers is orientation for a fresh clone.
 *
 * It reads through the sections' own HTTP endpoints rather than importing their
 * internals, so removing a section from `sections.ts` degrades a card to `—`
 * instead of breaking the build.
 */

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

function StatCard({ icon, label, value, sub, footer, href }: {
  icon: string; label: string; value: string; sub: string; footer?: string; href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-3xl font-black text-ink tabular-nums">{value}</span>
      </div>
      <div className="mt-1 text-label font-bold uppercase tracking-wider text-ink-fade">{label}</div>
      <div className="text-meta text-ink-mute">{sub}</div>
      {footer && <div className="mt-1.5 text-meta text-ink-fade">{footer}</div>}
    </>
  );
  const cls = 'flex-1 min-w-[168px] rounded border border-surface-rail bg-white p-4 text-left';
  return href
    ? <a href={href} className={`${cls} transition-colors hover:border-cyan-400`}>{inner}</a>
    : <div className={cls}>{inner}</div>;
}

export function HomeView() {
  const config = useDashboardConfig();
  // Leaf destinations, not the top-level groups — the groups are nav headings and
  // listing them here would name three things you cannot open. Excludes this page.
  const installed = destinations.filter((s) => s.id !== 'day');
  const has = (id: string) => installed.some((s) => s.id === id);
  // Paths come from the registry rather than being retyped here — they moved when
  // the nav became grouped (/tasks -> /today/tasks) and a hardcoded href would have
  // quietly pointed at nothing.
  const pathOf = (id: string) => installed.find((s) => s.id === id)?.path ?? '/';

  // `null` fetcher = SWR skips the request entirely, so a dashboard without the
  // Tasks or Meetings section never calls an endpoint its server does not mount.
  const { data: tasks } = useSWR<TasksResponse | null>(
    has('tasks') ? '/api/tasks' : null, () => jsonFetch<TasksResponse>('/api/tasks'),
    { revalidateOnFocus: false },
  );
  const { data: meetings } = useSWR<MeetingFile[] | null>(
    has('meetings') ? '/api/meetings' : null, () => jsonFetch<MeetingFile[]>('/api/meetings'),
    { revalidateOnFocus: false },
  );

  const standingTotal = (tasks?.standing ?? []).reduce((n, g) => n + g.items.length, 0);
  const todayCount = tasks?.today?.top3?.length ?? 0;

  // Open action items split by owner. "Mine" comes from ownerName in the dashboard
  // config — with no name configured nothing counts as mine, which is the honest
  // default rather than claiming everything.
  const UNCHECKED = /^[ \t]*[-*][ \t]*\[ \][ \t]/;
  let mine = 0;
  let others = 0;
  for (const m of meetings ?? []) {
    for (const line of m.markdown.split('\n')) {
      if (!UNCHECKED.test(line)) continue;
      const owner = line.match(/Owner:\s*([^`\n(]*)/i)?.[1] ?? line.match(/\(—\s*([^,)\n]*)/)?.[1] ?? '';
      if (isOwnedByViewer(owner, config)) mine++;
      else others++;
    }
  }

  return (
    <div>
      <div className="px-8 pt-8 pb-6">
        <h1 className="text-2xl font-black text-ink">
          Good {timeOfDay()}{config.ownerName ? `, ${config.ownerName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-ink-mute">Here's your command center.</p>
      </div>

      {(has('tasks') || has('meetings')) && (
        <div className="px-8 pb-6 flex flex-wrap gap-4">
          {has('tasks') && (
            <StatCard
              icon="📋" label="Backlog" href={pathOf('tasks')}
              value={standingTotal > 0 ? String(standingTotal) : '—'}
              sub="standing tasks"
              footer={todayCount > 0 ? `${todayCount} in today's Top 3` : 'no Top 3 set today'}
            />
          )}
          {has('meetings') && (
            <StatCard
              icon="✅" label="Action items" href={pathOf('meetings')}
              value={mine > 0 ? String(mine) : '—'}
              sub="open and yours"
              footer={others > 0 ? `${others} owned by others` : undefined}
            />
          )}
        </div>
      )}

      <div className="px-8 pb-8 max-w-3xl">
        <h2 className="text-label font-bold uppercase tracking-wider text-ink-fade">
          Installed sections
        </h2>
        <ul className="mt-3 divide-y divide-surface-rail border-y border-surface-rail">
          {installed.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="text-lg">{s.icon}</span>
              <a href={s.path} className="font-bold text-ink hover:text-cyan-700">{s.label}</a>
              {s.requiredEnv?.length ? (
                <span className="ml-auto text-meta text-ink-fade">
                  needs {s.requiredEnv.join(', ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="cyan-card mt-8">
          <h2 className="font-bold text-ink">Where your data lives</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-mute">
            <li>
              <code>content/</code> — the markdown Tasks, Journal and Meetings read and
              write. Yours to edit directly, or point <code>CONTENT_ROOT</code> at
              another folder.
            </li>
            <li>
              <code>.data/</code> — the Pull requests section's projects, squads and
              saved checkpoints.
            </li>
            <li>
              <code>.env</code> — your tokens. Nothing is shared with anyone.
            </li>
          </ul>
        </div>

        <p className="mt-8 text-meta text-ink-fade">
          Add a section with <code>pnpm add @asucregonzalez/section-&lt;name&gt;</code>,
          then list it in <code>src/sections.ts</code>. See the README.
        </p>
      </div>
    </div>
  );
}
