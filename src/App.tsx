import { useEffect, useState } from 'react';
import { DashboardConfigProvider, type DashboardConfig } from '@asucregonzalez/ui';
import type { DashboardSection } from '@asucregonzalez/core';
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

/** First child of a group, or the entry itself when it has none. */
function firstLeaf(s: DashboardSection): DashboardSection {
  return s.children?.[0] ?? s;
}

/**
 * Which destination the current URL names, as [groupId, leafId].
 *
 * The nav keeps the URL in step so a link works and a deep link resolves. Without
 * this the shell tracked the active tab in state only, so every `href` in the app
 * reloaded the page and landed back on the default tab — a link that looks live and
 * silently resets you.
 */
function routeFromPath(pathname: string): [string, string] {
  for (const g of sections) {
    for (const c of g.children ?? [g]) {
      if (c.path === pathname) return [g.id, c.id];
    }
  }
  const first = sections[0];
  return [first?.id ?? '', first ? firstLeaf(first).id : ''];
}

/**
 * The shell: two nav rows built from the section registry, and the active
 * destination's own view below them. Sections own their entire body — this file
 * never needs to know what any of them do.
 *
 * Two rows rather than one because groups and destinations answer different
 * questions. Row 1 is "which part of the job", row 2 is "which view of it". A
 * single flat row works at five tabs and stops working at twelve, and by then
 * every tab has equal weight so nothing reads as the important one.
 */
export function App() {
  const [initialGroup, initialLeaf] = routeFromPath(window.location.pathname);
  const [groupId, setGroupId] = useState(initialGroup);
  const group = sections.find((s) => s.id === groupId) ?? sections[0];
  const children = group?.children ?? [];
  const [leafId, setLeafId] = useState(initialLeaf);
  // Falls back to the group's first child whenever the remembered leaf belongs to a
  // different group, which is every time you switch rows.
  const active = children.find((c) => c.id === leafId) ?? (group ? firstLeaf(group) : undefined);

  // Back/forward must move the app, not just the address bar. Declared before the
  // early return below: a hook after a conditional return changes hook order
  // between renders, which React throws on.
  useEffect(() => {
    const onPop = () => {
      const [g, l] = routeFromPath(window.location.pathname);
      setGroupId(g);
      setLeafId(l);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);


  if (!group || !active) {
    return (
      <div className="p-8 text-ink-mute">
        No sections installed. Add one to <code>src/sections.ts</code>.
      </div>
    );
  }

  // `View` is optional as of @asucregonzalez/core 0.2.0: a group carries `children`
  // instead of rendering anything itself, and `active` is always a leaf — so this is
  // a type guard rather than a real state. Reading an optional field as if it were
  // required is exactly what `tsc` in the build script now catches.
  const ActiveView = active.View ?? (() => (
    <div className="p-8 text-ink-mute">
      <code>{active.id}</code> has no <code>View</code> — give it one in{' '}
      <code>src/sections.ts</code>.
    </div>
  ));
  const isFull = active.layout === 'full';

  const go = (g: DashboardSection, leaf: DashboardSection) => {
    setGroupId(g.id);
    setLeafId(leaf.id);
    if (leaf.path && leaf.path !== window.location.pathname) {
      window.history.pushState({}, '', leaf.path);
    }
  };
  const selectGroup = (s: DashboardSection) => go(s, firstLeaf(s));

  return (
    <DashboardConfigProvider value={DASHBOARD_CONFIG}>
      <div className="flex h-full flex-col bg-white">
        <header className="border-b border-surface-rail">
          <div className="flex items-center gap-6 px-6 py-3">
            <span className="banner banner--sm">Command Center</span>
            <nav className="flex gap-1 overflow-x-auto" aria-label="Sections">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectGroup(s)}
                  title={s.blurb}
                  aria-current={s.id === group.id ? 'page' : undefined}
                  className={`whitespace-nowrap px-3 py-1.5 text-sm font-bold transition-colors ${
                    s.id === group.id
                      ? 'border-b-2 border-cyan-400 text-ink'
                      : 'text-ink-fade hover:text-ink'
                  }`}
                >
                  <span className="mr-1.5">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Second row. Rendered whenever the group has more than one child — a
              single-child group would just repeat its own name back at you. */}
          {children.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto border-t border-surface-rail bg-surface-soft/40 px-6 py-1.5">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(group, c)}
                  title={c.blurb}
                  aria-current={c.id === active.id ? 'page' : undefined}
                  className={`whitespace-nowrap rounded px-2.5 py-1 text-meta font-bold transition-colors ${
                    c.id === active.id
                      ? 'bg-white text-cyan-700 shadow-sm'
                      : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  <span className="mr-1">{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}
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
