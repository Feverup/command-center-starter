import type { DashboardSection } from '@andreasucreg/core';
import { pullRequestsSection } from '@andreasucreg/section-pull-requests';
import { tasksSection } from '@andreasucreg/section-tasks';
import { journalSection } from '@andreasucreg/section-journal';
import { meetingsSection } from '@andreasucreg/section-meetings';
import { HomeView } from './HomeView';

/**
 * The sections this dashboard runs — the one file you edit to add or remove a tab.
 *
 * To add a section: install it (`pnpm add @andreasucreg/section-<name>`), import
 * its descriptor here, and add it to the array. If it has a server side, also
 * mount its router in `server/index.ts`.
 *
 * Order here is the order of the tabs.
 */
export const sections: DashboardSection[] = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/', visibility: 'shared', View: HomeView },
  pullRequestsSection,
  tasksSection,
  journalSection,
  meetingsSection,
];
