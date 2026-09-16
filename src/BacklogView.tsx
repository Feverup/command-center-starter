import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { jsonFetch } from '@asucregonzalez/http';
import type { BacklogItem } from '../server/backlog';
import { BACKLOG_CONFIG as CFG, PRIORITIES, STATUSES } from './backlog-config';

/**
 * Backlog — a scored backlog, editable in place.
 *
 * App-local, like HomeView and GuideView. Every edit is a write to
 * `content/backlog/<board>.md`, so the markdown and the app never disagree and
 * `git diff` shows what you changed.
 *
 * The job of the page is to answer "what do we build next?", which means the summary
 * has to be the capacity arithmetic — how many weeks each priority band holds — not a
 * count of rows. A list of thirty items tells you nothing; a committed band of nine
 * weeks against a six-week quarter tells you what to cut.
 *
 * Everything situational — the board, the products, which band counts as committed,
 * the capacity line — lives in `./backlog-config`, not here.
 */

const BOARD = CFG.board;
const SQUADS = CFG.products.map((p) => p.name);

/** The colours are the fastest way to see the split between products. */
const SQUAD_STYLE: Record<string, string> = {
  ...Object.fromEntries(CFG.products.map((p) => [p.name, p.style])),
  '': 'bg-white text-ink-fade border-surface-rail',
};

/** The product filter: every product, minus the shared value — an item marked shared
 *  shows under either one, so offering it as its own filter would imply otherwise. */
const PRODUCT_FILTERS = ['All', ...SQUADS.filter((s) => s !== CFG.sharedProduct)];

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-red-100 text-red-800 border-red-300',
  P1: 'bg-amber-100 text-amber-800 border-amber-300',
  P2: 'bg-sky-100 text-sky-800 border-sky-300',
  P3: 'bg-slate-100 text-slate-600 border-slate-300',
  '': 'bg-white text-ink-fade border-surface-rail',
};

const STATUS_STYLE: Record<string, string> = {
  Draft: 'text-violet-700',
  Backlog: 'text-ink-mute',
  'In flight': 'text-sky-700',
  Dropped: 'text-ink-fade line-through',
};

/**
 * Effort as a number of weeks, for the band totals. `3w` → 3, `days` → 0.5, `?` → 0.
 * An unknown effort counts as zero and is reported separately rather than guessed —
 * a made-up number in a capacity total is worse than a visible gap.
 */
function weeks(effort: string): number | null {
  const e = effort.trim().toLowerCase();
  if (!e || e === '?') return null;
  if (e.startsWith('days') || e === 'days') return 0.5;
  const m = e.match(/([\d.]+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Unscored sorts FIRST — above P0.
 *
 * Not because it is the most urgent, but because it is the only state that needs an
 * action from you rather than from the squad. A new row lands unscored at the top of
 * the list and stays in your eyeline until it has a priority; anywhere else and the
 * cheapest thing to do with it is nothing.
 */
const RANK: Record<string, number> = { '': -1, P0: 0, P1: 1, P2: 2, P3: 3 };

type SortKey = 'ref' | 'priority' | 'added' | 'effort';

/** Days between an ISO date and today, or null when the date is missing/unparseable. */
function ageDays(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then.getTime()) / 86400000,
  );
  return days >= 0 ? days : null;
}

function SortHeader({ label, k, sort, setSort, className }: {
  label: string; k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={`p-2 text-left font-bold ${className ?? ''}`}>
      <button
        onClick={() => setSort({ key: k, dir: active && sort.dir === 1 ? -1 : 1 })}
        className={`inline-flex items-center gap-1 rounded px-1 hover:text-ink ${active ? 'text-ink' : ''}`}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <span className={active ? '' : 'opacity-25'}>{active && sort.dir === -1 ? '\u2191' : '\u2193'}</span>
      </button>
    </th>
  );
}

function Cell({ value, onSave, placeholder, mono }: {
  value: string; onSave: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  if (!editing) {
    return (
      <button
        onClick={() => setDraft(value)}
        className={`w-full text-left rounded px-1.5 py-1 hover:bg-surface-sink ${mono ? 'tabular-nums' : ''} ${value ? '' : 'text-ink-fade'}`}
      >
        {value || placeholder || '—'}
      </button>
    );
  }
  const commit = () => { if (draft !== value) onSave(draft); setDraft(null); };
  return (
    <input
      autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="w-full rounded border border-cyan-400 px-1.5 py-1 outline-none"
    />
  );
}

/**
 * Asked before a row leaves the board.
 *
 * Two outcomes, deliberately not one. Dropping keeps the row and its reasoning, so a
 * decision stays decided and the ref someone quoted still resolves. Deleting retires
 * the ref for good — right for a duplicate or a typo, wrong for anything that was ever
 * discussed. Dropping is the default action and takes the primary button; deleting is
 * the quiet one on the left.
 */
function RemoveDialog({ item, onDrop, onDelete, onCancel }: {
  item: BacklogItem;
  onDrop: () => void; onDelete: () => void; onCancel: () => void;
}) {
  const alreadyDropped = item.status === 'Dropped';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog" aria-modal="true" aria-labelledby="rm-title"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded border border-surface-rail bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rm-title" className="text-lg font-black text-ink">
          Remove {item.ref} from the board?
        </h2>
        <p className="mt-1 text-sm text-ink-mute">{item.item}</p>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          {!alreadyDropped && (
            <div className="rounded border border-surface-rail bg-surface-sink p-3">
              <div className="font-semibold text-ink">Mark as dropped</div>
              <div className="text-meta text-ink-mute">
                Keeps the row and its notes, hidden behind “Show dropped”. The decision stays
                on record and {item.ref} still resolves for anyone who quoted it.
              </div>
            </div>
          )}
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <div className="font-semibold text-red-800">Delete permanently</div>
            <div className="text-meta text-red-900/70">
              The row is gone and {item.ref} is retired — it will never be reissued, so the
              reference stops resolving. Right for a duplicate or a typo.
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={onDelete}
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Delete permanently
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded border border-surface-rail px-3 py-1.5 text-sm font-semibold hover:border-cyan-400"
            >
              Cancel
            </button>
            {!alreadyDropped && (
              <button
                autoFocus onClick={onDrop}
                className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-white"
              >
                Mark as dropped
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BacklogView() {
  const { data, mutate } = useSWR<{ items: BacklogItem[] }>(
    `/api/backlog/${BOARD}`, (u: string) => jsonFetch(u), { revalidateOnFocus: false },
  );
  const [adding, setAdding] = useState(false);
  // The row the × was pressed on. Removing a row is the only irreversible action on
  // this board and it retires the item's ref, so it asks first — and offers the
  // reversible option (drop it) alongside the permanent one.
  const [confirming, setConfirming] = useState<BacklogItem | null>(null);
  // Confirmation that a permanent delete actually happened. Deliberately not an undo:
  // re-adding the row would mint a NEW ref, because deleted numbers are retired and
  // never reissued — so an "Undo" button would quietly lie about restoring EX-34.
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showDropped, setShowDropped] = useState(false);
  // 'All', or one of CFG.products. An item on the shared product shows under either
  // one, because filtering it out of a product view would hide work that product needs.
  const [squadFilter, setSquadFilter] = useState('All');
  // Click a sortable header to sort by it; click again to reverse. Priority first,
  // because that is the question the page exists to answer.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'priority', dir: 1 });

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const all = data?.items ?? [];
  const inFilter = (i: BacklogItem) =>
    squadFilter === 'All' || i.squad === squadFilter ||
    (CFG.sharedProduct !== null && i.squad === CFG.sharedProduct);
  const live = all.filter((i) => i.status !== 'Dropped');

  const compare = (a: BacklogItem, b: BacklogItem): number => {
    if (sort.key === 'priority') return (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3);
    // ISO dates sort correctly as strings; an undated row goes last either way rather
    // than sorting as the year 0.
    if (sort.key === 'added') {
      if (!a.added !== !b.added) return a.added ? -1 : 1;
      return a.added.localeCompare(b.added);
    }
    if (sort.key === 'ref') return a.ref.localeCompare(b.ref, undefined, { numeric: true });
    const x = weeks(a.effort), y = weeks(b.effort);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return x - y;
  };
  const rows = (showDropped ? all : live)
    .filter(inFilter)
    .slice()
    .sort((a, b) => compare(a, b) * sort.dir);

  async function patch(id: string, field: keyof BacklogItem, value: string) {
    // Optimistic: the table is the thing you are thinking in, so it must not flicker
    // between keystroke and server round-trip.
    mutate(
      async () => {
        await jsonFetch(`/api/backlog/${BOARD}/${id}`, {
          method: 'PATCH', body: JSON.stringify({ [field]: value }),
        });
        return jsonFetch<{ items: BacklogItem[] }>(`/api/backlog/${BOARD}`);
      },
      { optimisticData: { items: all.map((i) => i.id === id ? { ...i, [field]: value } : i) }, revalidate: false },
    );
  }

  async function add() {
    const item = draft.trim();
    if (!item) return;
    setDraft(''); setAdding(false);
    // Adding while filtered to a product means you meant that product.
    const squad = squadFilter === 'All' ? '' : squadFilter;
    await jsonFetch(`/api/backlog/${BOARD}`, { method: 'POST', body: JSON.stringify({ item, squad }) });
    mutate();
  }

  async function remove(id: string) {
    const gone = all.find((i) => i.id === id);
    setConfirming(null);
    try {
      await mutate(
        async () => {
          await jsonFetch(`/api/backlog/${BOARD}/${id}`, { method: 'DELETE' });
          return jsonFetch<{ items: BacklogItem[] }>(`/api/backlog/${BOARD}`);
        },
        { optimisticData: { items: all.filter((i) => i.id !== id) }, revalidate: false },
      );
      // Only after the server confirms — a toast fired optimistically would claim a
      // delete that a failed request left undone.
      setToast(`${gone?.ref ?? 'Item'} deleted permanently — ${gone?.ref ?? 'the ref'} is retired and will not be reissued.`);
    } catch {
      setToast(`Could not delete ${gone?.ref ?? 'the item'}. It is still on the board.`);
      mutate();
    }
  }

  // Band totals over items that will actually be built. Draft is excluded alongside
  // In flight: a candidate nobody has reviewed yet is not a commitment, and letting it
  // into the total is how a backlog quietly looks full before anyone agreed to any of
  // it. In flight is someone else's team doing the work, so it is not our capacity.
  const plannable = live.filter((i) => i.status === 'Backlog' && inFilter(i));
  const bands = ['P0', 'P1', 'P2', 'P3', ''].map((p) => {
    const inBand = plannable.filter((i) => i.priority === p);
    const known = inBand.map((i) => weeks(i.effort)).filter((w): w is number => w !== null);
    return {
      priority: p,
      count: inBand.length,
      weeks: known.reduce((a, b) => a + b, 0),
      unknown: inBand.length - known.length,
    };
  }).filter((b) => b.count > 0);

  // The committed band is one band, not "everything urgent". Where P0 means this
  // quarter and P1 means next, adding P1 in would charge next quarter's work to this
  // one — so the check is against CFG.committedBand alone.
  const committed = bands
    .filter((b) => b.priority === CFG.committedBand)
    .reduce((a, b) => a + b.weeks, 0);

  /**
   * The allocation question, answered in weeks: of the work in the committed band,
   * how much belongs to each product? This is the number behind "do we keep pushing
   * on one product, or split back to the other" — a row count would not answer it,
   * because two products' items are not the same size.
   */
  const byProduct = SQUADS.map((sq) => {
    const mine = live.filter((i) => i.status === 'Backlog' && i.squad === sq);
    const urgent = mine.filter((i) => i.priority === CFG.committedBand);
    const w = (xs: BacklogItem[]) =>
      xs.map((i) => weeks(i.effort)).filter((n): n is number => n !== null).reduce((a, b) => a + b, 0);
    return { squad: sq, count: mine.length, all: w(mine), urgent: w(urgent) };
  }).filter((s) => s.count > 0);

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-black text-ink">{CFG.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-mute">
        {CFG.intro} Every item has a ref like{' '}
        <code className="text-meta">{CFG.refPrefix}-07</code> to point at it elsewhere. Click
        any cell to edit; every change writes straight to{' '}
        <code className="text-meta">content/backlog/{BOARD}.md</code>.
      </p>

      {/* The split between the two products, in weeks — the allocation question. */}
      <div className="mt-6 flex flex-wrap gap-3">
        {byProduct.map((s) => (
          <div key={s.squad} className="min-w-[190px] flex-1 rounded border border-surface-rail bg-white p-3">
            <div className={`inline-block rounded border px-1.5 text-label font-bold ${SQUAD_STYLE[s.squad]}`}>
              {s.squad}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-ink tabular-nums">{s.urgent || '—'}w</span>
              <span className="text-meta text-ink-mute">{CFG.committedShort}</span>
            </div>
            <div className="text-meta text-ink-fade">
              {s.count} open · {s.all}w if we built all of it
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-label font-bold uppercase tracking-wider text-ink-fade">Product</span>
        {PRODUCT_FILTERS.map((s) => (
          <button
            key={s} onClick={() => setSquadFilter(s)}
            className={`rounded border px-2.5 py-1 text-sm font-semibold ${
              squadFilter === s ? 'border-ink bg-ink text-white' : 'border-surface-rail bg-white hover:border-cyan-400'
            }`}
          >
            {s}
          </button>
        ))}
        {squadFilter !== 'All' && (
          <span className="text-meta text-ink-fade">shared items appear in both views</span>
        )}
      </div>

      {/* The capacity read, which is the reason the page exists. */}
      <div className="mt-6 flex flex-wrap items-stretch gap-3">
        {bands.map((b) => (
          <div key={b.priority || 'none'} className="min-w-[132px] rounded border border-surface-rail bg-white p-3">
            <div className={`inline-block rounded border px-1.5 text-label font-bold ${PRIORITY_STYLE[b.priority]}`}>
              {b.priority || 'Unscored'}
            </div>
            <div className="mt-1.5 text-2xl font-black text-ink tabular-nums">
              {b.weeks ? `${b.weeks}w` : '—'}
            </div>
            <div className="text-meta text-ink-mute">
              {b.count} item{b.count === 1 ? '' : 's'}
              {b.unknown > 0 && <span className="text-ink-fade"> · {b.unknown} unsized</span>}
            </div>
          </div>
        ))}
        <div className="min-w-[164px] rounded border border-cyan-300 bg-cyan-50 p-3">
          <div className="text-label font-bold uppercase tracking-wider text-cyan-800">{CFG.committedLabel}</div>
          <div className="mt-1.5 text-2xl font-black text-ink tabular-nums">{committed || '—'}w</div>
          <div className="text-meta text-ink-mute">
            {CFG.capacityNote}{squadFilter !== 'All' ? ` · ${squadFilter} only` : ''}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded border border-surface-rail bg-white px-3 py-1.5 text-sm font-semibold hover:border-cyan-400"
        >
          + Add item
        </button>
        <label className="flex items-center gap-1.5 text-sm text-ink-mute">
          <input type="checkbox" checked={showDropped} onChange={(e) => setShowDropped(e.target.checked)} />
          Show dropped ({all.length - live.length})
        </label>
        {live.filter((i) => i.status === 'Draft' && inFilter(i)).length > 0 && (
          <span className="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-meta font-semibold text-violet-800">
            {live.filter((i) => i.status === 'Draft' && inFilter(i)).length} draft — not counted in the totals until reviewed
          </span>
        )}
      </div>

      {adding && (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus value={draft} placeholder="What is the item?"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
            className="flex-1 rounded border border-cyan-400 px-3 py-1.5 outline-none"
          />
          <button onClick={add} className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-white">Add</button>
        </div>
      )}

      {toast && (
        <div
          role="status" aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded border border-surface-rail bg-ink px-4 py-3 text-white shadow-lg"
        >
          <span className="text-sm leading-snug">{toast}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="-mr-1 rounded px-1 text-white/60 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {confirming && (
        <RemoveDialog
          item={confirming}
          onCancel={() => setConfirming(null)}
          onDelete={() => remove(confirming.id)}
          onDrop={() => { patch(confirming.id, 'status', 'Dropped'); setConfirming(null); }}
        />
      )}

      <div className="mt-4 overflow-x-auto rounded border border-surface-rail bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-surface-rail bg-surface-sink text-label uppercase tracking-wider text-ink-fade">
              <SortHeader label="Ref" k="ref" sort={sort} setSort={setSort} />
              <SortHeader label="Priority" k="priority" sort={sort} setSort={setSort} />
              <th className="p-2 text-left font-bold">Product</th>
              <th className="p-2 text-left font-bold">Item</th>
              <SortHeader label="Added" k="added" sort={sort} setSort={setSort} />
              <th className="p-2 text-left font-bold">Area</th>
              <SortHeader label="Effort" k="effort" sort={sort} setSort={setSort} />
              <th className="p-2 text-left font-bold">Status</th>
              <th className="p-2 text-left font-bold">Notes</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className="border-b border-surface-rail last:border-0 align-top">
                <td className="p-2 w-16 whitespace-nowrap font-mono text-meta font-semibold text-ink-mute tabular-nums">
                  {it.ref || '—'}
                </td>
                <td className="p-2">
                  <select
                    value={it.priority}
                    onChange={(e) => patch(it.id, 'priority', e.target.value)}
                    className={`rounded border px-1.5 py-0.5 text-label font-bold ${PRIORITY_STYLE[it.priority] ?? PRIORITY_STYLE['']}`}
                  >
                    <option value="">—</option>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <select
                    value={it.squad}
                    onChange={(e) => patch(it.id, 'squad', e.target.value)}
                    className={`rounded border px-1.5 py-0.5 text-meta font-semibold ${SQUAD_STYLE[it.squad] ?? SQUAD_STYLE['']}`}
                  >
                    <option value="">—</option>
                    {SQUADS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-2 min-w-[260px] font-medium text-ink">
                  <Cell value={it.item} onSave={(v) => patch(it.id, 'item', v)} />
                </td>
                {/* Date and age sit in a flex row rather than side by side in the cell:
                    Cell renders a `w-full` button, so an age appended after it had
                    nowhere to go and a three-digit one (anything past 99 days) spilled
                    over the Area column. `shrink-0` keeps the age whole and lets the
                    date truncate instead, because the age is the part you scan for. */}
                <td className="p-2 min-w-[124px] whitespace-nowrap text-meta text-ink-mute tabular-nums">
                  <div className="flex items-baseline gap-1">
                    <Cell value={it.added} onSave={(v) => patch(it.id, 'added', v)} placeholder="—" mono />
                    {(() => {
                      const d = ageDays(it.added);
                      return d !== null && d > 0
                        ? <span className="shrink-0 text-ink-fade">{d}d</span>
                        : null;
                    })()}
                  </div>
                </td>
                <td className="p-2 min-w-[100px] text-ink-mute">
                  <Cell value={it.area} onSave={(v) => patch(it.id, 'area', v)} placeholder="area" />
                </td>
                <td className="p-2 w-20 text-ink-mute">
                  <Cell value={it.effort} onSave={(v) => patch(it.id, 'effort', v)} placeholder="?" mono />
                </td>
                <td className="p-2">
                  <select
                    value={it.status}
                    onChange={(e) => patch(it.id, 'status', e.target.value)}
                    className={`rounded border border-surface-rail bg-white px-1.5 py-0.5 text-meta ${STATUS_STYLE[it.status] ?? ''}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-2 min-w-[240px] text-meta text-ink-mute">
                  <Cell value={it.notes} onSave={(v) => patch(it.id, 'notes', v)} placeholder="add a note" />
                </td>
                <td className="p-2">
                  <button
                    onClick={() => setConfirming(it)}
                    title="Drop or delete this item"
                    className="rounded px-1 text-ink-fade hover:bg-red-50 hover:text-red-700"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-ink-mute">
                No items yet — add one above, or edit <code>content/backlog/{BOARD}.md</code>.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
