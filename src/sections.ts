import type { DashboardSection } from '@asucregonzalez/core';
import { pullRequestsSection } from '@asucregonzalez/section-pull-requests';
import { createTasksSection } from '@asucregonzalez/section-tasks';
import { journalSection } from '@asucregonzalez/section-journal';
import { meetingsSection } from '@asucregonzalez/section-meetings';
import { HomeView } from './HomeView';
import { WORK_TYPES } from './work-types';

/**
 * The sections this dashboard runs — the one file you edit to add or remove a tab.
 *
 * To add a section: install it (`pnpm add @asucregonzalez/section-<name>`), import
 * its descriptor here, and add it to the array. If it has a server side, also
 * mount its router in `server/index.ts`.
 *
 * Order here is the order of the tabs.
 */
export const sections: DashboardSection[] = [
  { id: 'home', label: 'Home', icon: '🏠', path: '/', visibility: 'shared', View: HomeView },
  pullRequestsSection,
  // Work-type buckets come from ./work-types, generated per role by /setup.
  createTasksSection({ workTypes: WORK_TYPES }),
  journalSection,
  meetingsSection,
];
