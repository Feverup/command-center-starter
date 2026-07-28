import { sections } from './sections';

/**
 * Home — deliberately empty. It lists what's installed and where its data comes
 * from, so a fresh clone explains itself. Replace it with whatever overview you
 * want; nothing else depends on it.
 */
export function HomeView() {
  const installed = sections.filter((s) => s.id !== 'home');

  return (
    <div className="mx-auto max-w-3xl px-2 py-8">
      <span className="banner banner--lg">Your Command Center</span>

      <p className="mt-6 text-ink-mute">
        Nothing here yet — this page is yours to fill. Your sections are in the tabs
        above.
      </p>

      <div className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-fade">
          Installed sections
        </h2>
        <ul className="mt-3 divide-y divide-surface-rail border-y border-surface-rail">
          {installed.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="text-lg">{s.icon}</span>
              <span className="font-bold text-ink">{s.label}</span>
              {s.requiredEnv?.length ? (
                <span className="ml-auto text-xs text-ink-ghost">
                  needs {s.requiredEnv.join(', ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

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

      <p className="mt-8 text-xs text-ink-ghost">
        Add a section with <code>pnpm add @andreasucreg/section-&lt;name&gt;</code>,
        then list it in <code>src/sections.ts</code>. See the README.
      </p>
    </div>
  );
}
