import type { DashboardSection } from '@asucregonzalez/core';
import { pullRequestsSection } from '@asucregonzalez/section-pull-requests';
import { roadmapSection } from '@asucregonzalez/section-roadmap';
import { createTasksSection } from '@asucregonzalez/section-tasks';
import { journalSection } from '@asucregonzalez/section-journal';
import { meetingsSection } from '@asucregonzalez/section-meetings';
import { HomeView } from './HomeView';
import { GuideView } from './GuideView';
import { WORK_TYPES } from './work-types';

/**
 * The sections this dashboard runs — the one file you edit to add or remove a tab.
 *
 * Grouped, not flat. Top-level entries are GROUPS holding `children`: a group is a
 * question ("what's on today?", "what's already written down?") and its children are
 * the places that answer it. The nav puts groups on one row and the active group's
 * children on a second, so installing more sections does not stretch a single row of
 * tabs until nothing in it stands out.
 *
 * A group needs no `View` of its own — landing on it opens its first child. That is
 * why `View` is optional in @asucregonzalez/core 0.2.0.
 *
 * To add a section: install it (`pnpm add @asucregonzalez/section-<name>`), import
 * its descriptor, and drop it into the right group's `children` — or start a new
 * group if it answers a genuinely different question. If it has a server side, also
 * mount its router in `server/index.ts`, and add a card in `src/GuideView.tsx` (How
 * to use names any section that has no card).
 *
 * Order here is the order of the tabs.
 */
export const sections: DashboardSection[] = [
  {
    id: 'today', label: 'Today', icon: '🏠', path: '/today', visibility: 'shared',
    blurb: 'What is on your plate right now.',
    children: [
      { id: 'day', label: 'Day', icon: '☀️', path: '/today', visibility: 'shared', View: HomeView,
        blurb: 'The cockpit: backlog size, what you owe from meetings, and where everything lives.' },
      // Work-type buckets come from ./work-types, generated per role by /setup.
      { ...createTasksSection({ workTypes: WORK_TYPES }), id: 'tasks', label: 'Tasks', path: '/today/tasks' },
      { ...pullRequestsSection, id: 'prs', label: 'PRs', path: '/today/prs' },
    ],
  },
  {
    // One roadmap per squad, read from `content/team/roadmaps/*.json` (or a single
    // `content/team/roadmap.json` if that is all you have). Squads are files, so
    // this grows by adding one — there is nothing to register here.
    id: 'delivery', label: 'Delivery', icon: '📦', path: '/delivery', visibility: 'shared',
    blurb: 'What you are shipping, and when.',
    children: [
      { ...roadmapSection, id: 'roadmap', label: 'Roadmap', path: '/delivery/roadmap' },
    ],
  },
  {
    id: 'archives', label: 'Archives', icon: '📚', path: '/archives', visibility: 'shared',
    blurb: 'Everything already written down.',
    children: [
      { ...journalSection, id: 'journal', label: 'Journal', path: '/archives/journal' },
      { ...meetingsSection, id: 'meetings', label: 'Meetings', path: '/archives/meetings' },
    ],
  },
  {
    // Guide is app-local on purpose: its cards describe THIS dashboard's tabs, so it
    // ships with the template rather than as a package. Its three parts are real nav
    // children rather than switches inside one view, so the second row shows what the
    // Guide contains without opening it.
    id: 'guide', label: 'Guide', icon: '📖', path: '/guide', visibility: 'shared',
    blurb: 'How to set this up, and how to use it.',
    children: [
      { id: 'setup', label: 'Setup', icon: '⚙️', path: '/guide/setup', visibility: 'shared',
        View: () => GuideView({ part: 'setup' }),
        blurb: 'First run: /setup, the one required token, what to do when install fails.' },
      { id: 'how-to', label: 'How to use', icon: '📖', path: '/guide/how-to', visibility: 'shared',
        View: () => GuideView({ part: 'usage' }),
        blurb: 'What each tab does, and which jobs are faster asked than clicked.' },
      { id: 'faq', label: 'FAQs', icon: '❓', path: '/guide/faq', visibility: 'shared',
        View: () => GuideView({ part: 'faq' }),
        blurb: 'Empty tab, stale numbers, editing the markdown directly.' },
    ],
  },
];

/**
 * Every leaf destination, flattened. The Guide's drift check counts against this —
 * not `sections` — so a group heading never reads as an undocumented section.
 */
export const destinations: DashboardSection[] = sections.flatMap((s) => s.children ?? [s]);
