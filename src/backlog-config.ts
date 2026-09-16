/**
 * The Backlog tab's settings — the one file to edit to point it at your own board.
 *
 * Kept out of `BacklogView.tsx` for the same reason `work-types.ts` is kept out of
 * the task board: the view is the same for everyone, the vocabulary is not. A team
 * splitting work across two surfaces, a quarter that starts on a particular Monday,
 * a priority band that means "committed" rather than "urgent" — all of that is yours,
 * and none of it should mean editing a React component.
 *
 * The board id is the filename: `board: 'foo'` reads and writes `content/backlog/foo.md`.
 * Point it at a file that does not exist yet and the tab opens empty and offers to add
 * the first row, rather than reporting an error — so renaming the board below and
 * starting fresh is a one-line change, not a migration.
 *
 * What ships here is the example board in `content/backlog/example.md`. Change the
 * values to yours; the shipped file is there so a fresh clone has something to look
 * at, and deleting it is the expected second step.
 */

export type BacklogProduct = {
  /** As written in the file's PRODUCT column. Must match exactly. */
  name: string;
  /** Tailwind classes for the chip. Keep them visually distinct — the colour is how
   *  the split between products reads at a glance. */
  style: string;
};

export type BacklogConfig = {
  board: string;
  title: string;
  /** One or two sentences under the title: what this board holds, and what it excludes. */
  intro: string;
  products: BacklogProduct[];
  /** The product name meaning "counts for both". Items marked with it appear under
   *  either product's filter, because hiding a shared dependency from a product view
   *  is how it loses its owner. Set to null if your board has no such value. */
  sharedProduct: string | null;
  /** The priority band that is actually committed, as opposed to merely ranked. Its
   *  weeks are what gets checked against capacity below. */
  committedBand: string;
  /** How that band reads in the UI — e.g. 'P0 · Q4'. */
  committedLabel: string;
  /** Short suffix on each product card, e.g. 'in Q4 (P0)'. */
  committedShort: string;
  /** The capacity the committed band is measured against, in your own words. This is
   *  deliberately prose, not a number: the useful sentence is "against ~6 weeks from
   *  17 Nov", and no amount of date arithmetic produces it for you. */
  capacityNote: string;
  /** Prefix for new refs (`EX` gives `EX-07`). The server keeps using whatever prefix
   *  a board's existing rows already carry, so changing this only affects a new board. */
  refPrefix: string;
};

export const BACKLOG_CONFIG: BacklogConfig = {
  board: 'example',
  title: 'Post-launch backlog',
  intro: 'Everything held back from the first release, across both surfaces.',
  products: [
    { name: 'Web', style: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
    { name: 'Mobile', style: 'bg-orange-100 text-orange-900 border-orange-300' },
    { name: 'Both', style: 'bg-violet-100 text-violet-900 border-violet-300' },
  ],
  sharedProduct: 'Both',
  committedBand: 'P0',
  committedLabel: 'P0 · this quarter',
  committedShort: 'committed (P0)',
  capacityNote: 'against the weeks you actually have',
  refPrefix: 'EX',
};

/** Priority bands, highest first. Unscored sorts above all of them — see BacklogView. */
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

/** Where an item stands. Only `Backlog` counts toward the capacity totals. */
export const STATUSES = ['Draft', 'Backlog', 'In flight', 'Dropped'];
