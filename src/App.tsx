import { useState } from 'react';
import { DashboardConfigProvider, type DashboardConfig } from '@asucregonzalez/ui';
import { sections } from './sections';

/**
 * Host config for the installed sections.
 *  - ownerName: your name as it appears in an `Owner:` field, so the Meetings
 *    section can split action items into yours vs everyone else's. Set
 *    VITE_OWNER_NAME in .env.
 *  - refreshEnabled: false because this app serves no /api/refresh route, so
 *    sections hide their "Regenerate" buttons instead of offering a dead one.
 * Module-level constant on purpose: its identity must stay stable across renders.
 */
const DASHBOARD_CONFIG: DashboardConfig = {
  ownerName: import.meta.env.VITE_OWNER_NAME as string | undefined,
  refreshEnabled: false,
};

/**
 * The shell: a tab bar built from the section registry, and the active section's
 * own view below it. Sections own their entire body — this file never needs to
 * know what any of them do.
 */
export function App() {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  if (!active) {
    return (
      <div className="p-8 text-ink-mute">
        No sections installed. Add one to <code>src/sections.ts</code>.
      </div>
    );
  }

  const ActiveView = active.View;
  const isFull = active.layout === 'full';

  return (
    <DashboardConfigProvider value={DASHBOARD_CONFIG}>
      <div className="flex h-full flex-col bg-white">
        <header className="flex items-center gap-6 border-b border-surface-rail px-6 py-3">
          <span className="banner banner--sm">Command Center</span>
          <nav className="flex gap-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`px-3 py-1.5 text-sm font-bold transition-colors ${
                  s.id === active.id
                    ? 'border-b-2 border-cyan-400 text-ink'
                    : 'text-ink-fade hover:text-ink'
                }`}
              >
                <span className="mr-1.5">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        {isFull ? (
          <main className="flex min-h-0 flex-1 flex-col">
            <ActiveView />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto p-6">
            <ActiveView />
          </main>
        )}
      </div>
    </DashboardConfigProvider>
  );
}
