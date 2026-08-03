import { useState } from 'react';
import { sections } from './sections';

/**
 * Guide — setup, how to use it, and the questions people actually ask.
 *
 * Deliberately app-local rather than an installed package. The guide's content is
 * a description of *this* dashboard's tabs, so a shared package would either ship
 * cards for sections you never installed or need filtering to hide them — and a
 * published package would carry the other app's card text inside its tarball
 * whether it rendered or not.
 *
 * So: when you add or remove a section in `sections.ts`, edit the cards here too.
 * The card list is checked against the installed sections below, and anything
 * missing is called out rather than silently omitted.
 */

type Part = 'setup' | 'usage' | 'faq';
type Kind = 'in-app' | 'chat' | 'both';

interface Item { kind: Kind; text: string }
interface Card {
  /** Matches a section id in `sections.ts`, or `null` for a concept card. */
  section: string | null;
  icon: string;
  title: string;
  items: Item[];
  pre?: string;
}

const KIND_STYLE: Record<Kind, { label: string; cls: string }> = {
  'in-app': { label: 'in app', cls: 'bg-cyan-100 text-cyan-700' },
  chat: { label: 'ask Claude', cls: 'bg-violet-100 text-violet-700' },
  both: { label: 'both', cls: 'bg-surface-soft text-ink-mute' },
};

const SETUP: Card[] = [
  {
    section: null, icon: '⚙️', title: 'Run /setup once',
    items: [
      { kind: 'chat', text: 'In this folder, start Claude Code and run /setup. It asks for your name, email, GitHub handle, role, current goal, team and timezone — then fills those into CLAUDE.md and generates your role\'s work-type buckets in src/work-types.ts.' },
      { kind: 'both', text: 'Role decides the work-type buckets on the task board. Current goal is the tiebreaker whenever work has to be ranked: a task that moves the goal outranks an equally urgent one that does not.' },
      { kind: 'both', text: 'It also sets up an isolated `gws` config directory, so the Google auth this workspace uses never collides with another project\'s.' },
    ],
  },
  {
    section: null, icon: '▶️', title: 'Start it',
    pre: 'make dev        # dashboard + API\nmake claude      # Claude Code in this folder',
    items: [
      { kind: 'both', text: 'The dashboard and its API run as two processes; `make dev` starts both and prints the port. If a port is taken it picks the next one — check the line it prints rather than assuming 5173.' },
      { kind: 'both', text: 'A server-side change needs the API restarted; client changes hot-reload. If an edit seems to do nothing, that is the first thing to check.' },
    ],
  },
  {
    section: null, icon: '🔑', title: 'Tokens — only one is required',
    items: [
      { kind: 'both', text: 'GITHUB_TOKEN in .env is needed by the Pull requests tab and nothing else. Without it that tab is empty and the rest of the dashboard is fine.' },
      { kind: 'both', text: 'Google Workspace (Drive, Docs, Sheets, Gmail, Calendar) uses the `gws` CLI you authenticated during /setup — no token in .env, and it re-auths roughly weekly.' },
      { kind: 'both', text: 'Anything else — Sentry, Datadog, Jira, Slack — is a Claude connector authenticated with /mcp inside Claude Code, per user. Those are not dashboard integrations and do not belong in .env.' },
      { kind: 'both', text: '.env is gitignored. Keep it chmod 600, and never put a credential in content/ — those files are tracked.' },
    ],
  },
  {
    section: null, icon: '🚑', title: 'If install fails',
    items: [
      { kind: 'both', text: '"No matching version found" means package.json pins an @asucregonzalez/* version that is not published yet. Check with npm view <pkg> versions and ask the maintainer to publish — do not edit the pin or delete the lockfile to get past it.' },
      { kind: 'both', text: 'No registry token is needed: the packages are public. If npm asks you to log in, something else is wrong.' },
    ],
  },
];

const USAGE: Card[] = [
  {
    section: null, icon: '🧭', title: 'The basics',
    items: [
      { kind: 'both', text: 'Your data is plain markdown in content/. The dashboard, your editor and Claude all read and write the same files, and git is the safety net.' },
      { kind: 'both', text: 'Two formats are load-bearing. Journal entries need a bare `## YYYY-MM-DD` heading, and the Today block needs `**Top 3:**` written exactly like that. Get either wrong and the content stops rendering with no error.' },
      { kind: 'chat', text: 'Most updates are faster asked than clicked: "add a task…", "what did I commit to in yesterday\'s meetings?", "mark X done".' },
    ],
  },
  {
    section: 'home', icon: '🏠', title: 'Home',
    items: [
      { kind: 'in-app', text: 'Two numbers: your standing backlog with today\'s Top 3 count, and the open action items that are yours across all meeting notes. Both link to their tab.' },
      { kind: 'in-app', text: '"Yours" is decided by the owner name in the dashboard config — with no name set, nothing counts as yours, which is honest rather than claiming everything.' },
    ],
  },
  {
    section: 'tasks', icon: '✅', title: 'Tasks',
    items: [
      { kind: 'in-app', text: 'A standing backlog plus one Today block. Add, edit, complete or delete inline; it writes content/tasks/active.md.' },
      { kind: 'both', text: 'Every open task carries a priority: [P0] now, [P1] this cycle, [P2] later, [P3] nice-to-have. An untriaged task sorts ABOVE [P3], so leaving it off is not a way to hide it.' },
      { kind: 'both', text: 'Work type is the second marker — [Ship], [Quality] and so on from src/work-types.ts, generated for your role. Optional, but a board where most tasks have one can tell you where your week went.' },
      { kind: 'both', text: 'Tasks are atomic: one independently-checkable action per line. The Today Top 3 selects existing standing items verbatim rather than summarising them, so closing one closes its twin.' },
      { kind: 'both', text: 'The Top 3 is deliverables, never meetings. If a meeting matters, the task is its prep.' },
    ],
  },
  {
    section: 'prs', icon: '🔀', title: 'Pull requests',
    items: [
      { kind: 'in-app', text: 'Your open PRs and the ones waiting on your review, live from GitHub. Needs GITHUB_TOKEN in .env — if it is empty, that is the first thing to check.' },
      { kind: 'both', text: 'GitHub is already a review queue, so do not mirror PR reviews into Tasks. Non-review follow-ups a PR reveals — red CI, a merge conflict, changes to implement — do belong there.' },
    ],
  },
  {
    section: 'journal', icon: '📔', title: 'Journal',
    items: [
      { kind: 'in-app', text: 'A per-day archive of what actually happened, newest first, from content/tasks/journal.md.' },
      { kind: 'both', text: 'Each day is a bare `## YYYY-MM-DD` heading. A different heading shape parses as body text and the day silently disappears from the tab.' },
    ],
  },
  {
    section: 'meetings', icon: '🗒️', title: 'Meetings',
    items: [
      { kind: 'in-app', text: 'Meeting notes grouped into buckets in the sidebar, newest first, with a badge showing how many open action items in that group are yours.' },
      { kind: 'in-app', text: 'Action items are `- [ ]` lines; add `Owner: <name>` and the split between yours and everyone else\'s becomes meaningful.' },
      { kind: 'chat', text: 'Populate it with the meeting-processor skill (Granola) or sync-meetings (a Drive folder). Both write into content/meetings/ and tell you what they could not reach rather than inventing it.' },
    ],
  },
  {
    section: 'guide', icon: '📖', title: 'Guide (this tab)',
    items: [
      { kind: 'in-app', text: 'Three parts: Setup for first-run, How to use for what each tab does, FAQs for what goes wrong. Cards start collapsed — the count on the right is how many notes are inside.' },
      { kind: 'both', text: 'Its content lives in src/GuideView.tsx, not in a package, because it describes YOUR tabs. Add or remove a section and edit the cards here.' },
      { kind: 'both', text: 'If you forget, the bottom of How to use names the sections with no card — that is how this very card came to exist.' },
    ],
  },
  {
    section: null, icon: '🌅', title: 'Morning briefing',
    items: [
      { kind: 'chat', text: 'Ask for the daily-briefing skill. It reads your calendar, mail, PRs and backlog and proposes today\'s Top 3, ranked against your current goal from CLAUDE.md.' },
      { kind: 'both', text: 'A source you have not authenticated is skipped and reported, never guessed at. Fill in the blanks each skill asks for at the top before first use.' },
    ],
  },
];

const FAQ: Card[] = [
  {
    section: null, icon: '❓', title: 'Questions people actually ask',
    items: [
      { kind: 'both', text: 'A tab is empty. Either a missing token (only Pull requests needs one) or genuinely no data yet. An empty tab with no error is almost always the second.' },
      { kind: 'both', text: 'I changed something and nothing happened. In order of likelihood: the API needs restarting for a server-side change, you are looking at an older dev-server port, or the change was invisible by design. Hard-refresh before assuming a bug.' },
      { kind: 'both', text: 'Can I edit the markdown directly instead of using the app? Yes — the app, your editor and Claude all touch the same files in content/. Just keep the two load-bearing formats intact.' },
      { kind: 'both', text: 'Where is my data? content/ is your markdown, .data/ is section runtime state, .env is your tokens. The last two are gitignored, and none of it leaves your machine except through APIs you gave tokens for.' },
      { kind: 'both', text: 'How do I add a section? pnpm add @asucregonzalez/section-<name>, import it in src/sections.ts, and if it has a server side mount its router in server/index.ts. Then add a card to this guide.' },
      { kind: 'both', text: 'Is any of this shared with anyone? No. The installed packages are code only; they read the paths this app hands them.' },
    ],
  },
];

const PARTS: Array<{ id: Part; label: string; cards: Card[] }> = [
  { id: 'setup', label: 'Setup', cards: SETUP },
  { id: 'usage', label: 'How to use', cards: USAGE },
  { id: 'faq', label: 'FAQs', cards: FAQ },
];

export function GuideView() {
  const [part, setPart] = useState<Part>('usage');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const active = PARTS.find((p) => p.id === part)!;

  // Cards are matched to installed sections so the guide cannot quietly drift from
  // sections.ts: a card for a section you removed is hidden, and a section with no
  // card is named at the bottom instead of going undocumented in silence.
  const installedIds = new Set(sections.map((s) => s.id));
  const cards = active.cards.filter((c) => c.section === null || installedIds.has(c.section));
  const documented = new Set(active.cards.map((c) => c.section).filter(Boolean) as string[]);
  const missing = part === 'usage'
    ? sections.filter((s) => !documented.has(s.id)).map((s) => s.label)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-2 py-8">
      <div className="flex gap-2">
        {PARTS.map((p) => (
          <button
            key={p.id} type="button" onClick={() => setPart(p.id)}
            className={`px-3 py-1.5 rounded border text-sm ${
              p.id === part
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-bold'
                : 'border-surface-rail text-ink-mute hover:border-cyan-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {cards.map((c) => {
          const key = `${part}:${c.title}`;
          const isOpen = open[key] ?? false;
          return (
            <div key={key} className="rounded border border-surface-rail bg-white">
              <button
                type="button" aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className={`text-label text-ink-fade transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                <span className="text-base leading-none">{c.icon}</span>
                <span className="font-bold text-ink">{c.title}</span>
                <span className="ml-auto text-meta text-ink-fade tabular-nums">{c.items.length}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {c.pre && (
                    <pre className="rounded bg-surface-soft p-2.5 text-meta text-ink-mute overflow-x-auto">{c.pre}</pre>
                  )}
                  {c.items.map((it, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`flex-shrink-0 px-1.5 rounded text-label font-bold ${KIND_STYLE[it.kind].cls}`}>
                        {KIND_STYLE[it.kind].label}
                      </span>
                      <span className="text-ink-mute leading-relaxed">{it.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="mt-6 text-meta text-ink-fade">
          Not documented yet: {missing.join(', ')} — add a card in <code>src/GuideView.tsx</code>.
        </p>
      )}
    </div>
  );
}
