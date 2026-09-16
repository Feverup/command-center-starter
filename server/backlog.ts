import type { Router } from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Backlog API — a scored backlog, editable from the dashboard.
 *
 * App-local on purpose, like `projects.ts` and GuideView: it encodes this
 * workspace's planning conventions rather than anything general enough to package.
 *
 * The file is the source of truth, not a cache. `content/backlog/<id>.md` holds a
 * markdown table under `## Items`; the app reads it, writes it back, and leaves
 * everything above `## Items` untouched — so the prose that explains the format
 * survives every save, and editing the table in an editor is equally valid.
 *
 * Why a table and not JSON: this file is git-tracked and meant to be readable in a
 * diff. A reordered priority should show up in `git diff` as one changed cell.
 */

export type BacklogItem = {
  /** Short human reference — `EX-07`. What you say in a meeting or a Slack thread. */
  ref: string;
  /** Stable file key — a slug of the title. What the API and `git diff` use. */
  id: string;
  priority: string;   // 'P0' | 'P1' | 'P2' | 'P3' | '' (unscored)
  squad: string;      // one of BACKLOG_CONFIG.products, or '' (unassigned)
  added: string;      // ISO YYYY-MM-DD — when the item entered this list
  item: string;
  area: string;
  effort: string;
  status: string;     // Backlog | In MVP | In flight | Dropped
  notes: string;
};

const FIELDS = ['ref', 'id', 'added', 'priority', 'squad', 'item', 'area', 'effort', 'status', 'notes'] as const;
/** Column header per field, in file order. Parsing maps by NAME, so a hand-reordered
 *  or hand-extended table still reads correctly — see `parse`. */
const COLUMNS: Record<typeof FIELDS[number], string> = {
  ref: 'Ref', id: 'ID', added: 'Added', priority: 'Priority', squad: 'Squad', item: 'Item',
  area: 'Area', effort: 'Effort', status: 'Status', notes: 'Notes',
};
const HEADER = `| ${FIELDS.map((f) => COLUMNS[f]).join(' | ')} |`;
const DIVIDER = `|${FIELDS.map(() => '---').join('|')}|`;

/** Split a markdown table row into trimmed cells, dropping the outer pipes. */
function cells(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

/**
 * A cell cannot contain a raw `|` without ending the column, so escape on write and
 * unescape on read. Newlines collapse to spaces for the same reason — a row is a line.
 */
const escapeCell = (s: string) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
const unescapeCell = (s: string) => s.replace(/\\\|/g, '|');

function parse(md: string): BacklogItem[] {
  // Everything after the `## Items` heading. Without it there is no table to read,
  // which is a legitimate empty state rather than an error.
  const body = md.split(/^## Items\s*$/m)[1];
  if (!body) return [];

  // Columns are located by their header name, not their position. Adding a column by
  // hand, or reordering two, then reads correctly instead of shifting every value one
  // cell to the left — the failure that silently turns every Effort into a Status.
  let index: Partial<Record<typeof FIELDS[number], number>> | null = null;

  const out: BacklogItem[] = [];
  for (const line of body.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const c = cells(line);
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;   // the |---|---| divider
    if (!index) {
      if (!c.some((h) => h.toLowerCase() === 'id')) continue;  // nothing usable before the header
      index = {};
      for (const f of FIELDS) {
        const at = c.findIndex((h) => h.toLowerCase() === COLUMNS[f].toLowerCase());
        if (at !== -1) index[f] = at;
      }
      continue;
    }
    const at = (f: typeof FIELDS[number]) => {
      const i = index![f];
      return i === undefined ? '' : unescapeCell(c[i] ?? '');
    };
    if (!at('id')) continue;
    out.push({
      ref: at('ref'), id: at('id'), added: at('added'), priority: at('priority'), squad: at('squad'), item: at('item'),
      area: at('area'), effort: at('effort'), status: at('status') || 'Backlog', notes: at('notes'),
    });
  }
  return out;
}

const MARKER = /<!--\s*next-ref:\s*(\d+)\s*-->/;

/**
 * Rewrite only the table, preserving the prose above `## Items`.
 *
 * The one thing it does edit up there is the `<!-- next-ref: N -->` marker. Without a
 * high-water mark, deleting the last row frees its number and the next item reissues
 * it — so a `EX-32` written down in a doc or a thread would silently come to mean a
 * different feature. The marker is an HTML comment, so it is invisible when the
 * markdown is rendered and obvious when the file is edited by hand.
 */
function serialize(md: string, items: BacklogItem[], nextRef: number): string {
  let head = md.split(/^## Items\s*$/m)[0].replace(/\s*$/, '');
  const tag = `<!-- next-ref: ${nextRef} -->`;
  head = MARKER.test(head) ? head.replace(MARKER, tag) : `${head}\n\n${tag}`;
  const rows = items.map((it) =>
    `| ${FIELDS.map((f) => escapeCell(it[f])).join(' | ')} |`);
  return `${head}\n\n## Items\n\n${HEADER}\n${DIVIDER}\n${rows.join('\n')}\n`;
}

/** The number a new ref would take: whichever is higher, the marker or what is in use. */
function refCounter(md: string, items: BacklogItem[]): number {
  const marked = Number(md.match(MARKER)?.[1] ?? 0);
  const used = items.reduce((n, i) => {
    const m = REF.exec(i.ref?.trim() ?? '');
    return m ? Math.max(n, Number(m[2])) : n;
  }, 0);
  return Math.max(marked, used + 1);
}

/** `EX-07` — any letter prefix, so a board is not forced to adopt someone else's. */
const REF = /^([A-Za-z]+)-(\d+)$/;

/**
 * The prefix a board already uses, so refs stay consistent with whatever is written
 * down in docs and threads. A board whose rows disagree follows the most common one;
 * an empty board takes `fallback`, which is the only time the default applies.
 */
function refPrefix(items: BacklogItem[], fallback: string): string {
  const counts = new Map<string, number>();
  for (const i of items) {
    const m = REF.exec(i.ref?.trim() ?? '');
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  let best = fallback, bestN = 0;
  for (const [prefix, n] of counts) if (n > bestN) { best = prefix; bestN = n; }
  return best;
}

/** Local calendar date as YYYY-MM-DD — `toISOString()` would shift across midnight. */
function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Turn a title into a stable id. Collisions get a numeric suffix rather than
 * overwriting a neighbour — two items may legitimately be named the same thing
 * while they are being split apart.
 */
function slug(title: string, taken: Set<string>): string {
  const base = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function registerBacklogRoutes(
  router: Router,
  ctx: { contentRoot: string },
  opts: { refPrefix?: string } = {},
) {
  const dir = path.join(ctx.contentRoot, 'backlog');
  const fallbackPrefix = opts.refPrefix ?? 'PM';

  const fileFor = (board: string) => {
    // The board id comes from the URL, so it must never escape content/backlog/.
    if (!/^[a-z0-9-]+$/i.test(board)) return null;
    return path.join(dir, `${board}.md`);
  };

  const load = (file: string) => existsSync(file) ? readFileSync(file, 'utf8') : '';
  const save = (file: string, md: string) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, md, 'utf8');
  };

  router.get('/api/backlog/:board', (req, res) => {
    const file = fileFor(req.params.board);
    if (!file) return res.status(400).json({ error: 'bad board id' });
    if (!existsSync(file)) return res.json({ items: [] });
    res.json({ items: parse(readFileSync(file, 'utf8')) });
  });

  router.post('/api/backlog/:board', (req, res) => {
    const file = fileFor(req.params.board);
    if (!file) return res.status(400).json({ error: 'bad board id' });
    const title = String(req.body?.item ?? '').trim();
    if (!title) return res.status(400).json({ error: 'item is required' });
    const md = load(file);
    const items = parse(md);
    const n = refCounter(md, items);
    const it: BacklogItem = {
      ref: `${refPrefix(items, fallbackPrefix)}-${String(n).padStart(2, '0')}`,
      id: slug(title, new Set(items.map((i) => i.id))),
      // Stamped server-side so it records when the item really entered the list,
      // not whatever the client's clock says. Local date, not UTC: a row added at
      // 23:00 in Madrid belongs to that day, not tomorrow.
      added: String(req.body?.added ?? '').trim() || todayISO(),
      priority: String(req.body?.priority ?? ''),
      squad: String(req.body?.squad ?? ''),
      item: title,
      area: String(req.body?.area ?? ''),
      effort: String(req.body?.effort ?? ''),
      status: String(req.body?.status ?? 'Backlog'),
      notes: String(req.body?.notes ?? ''),
    };
    // New items go on top: you add one because you just thought of it, and burying
    // it at the bottom of thirty rows is how it gets forgotten before it is scored.
    save(file, serialize(md, [it, ...items], n + 1));
    res.json(it);
  });

  router.patch('/api/backlog/:board/:id', (req, res) => {
    const file = fileFor(req.params.board);
    if (!file || !existsSync(file)) return res.status(404).json({ error: 'not found' });
    const md = readFileSync(file, 'utf8');
    const items = parse(md);
    const idx = items.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    for (const f of FIELDS) {
      if (f === 'id') continue;
      if (req.body?.[f] !== undefined) items[idx][f] = String(req.body[f]);
    }
    save(file, serialize(md, items, refCounter(md, items)));
    res.json(items[idx]);
  });

  router.delete('/api/backlog/:board/:id', (req, res) => {
    const file = fileFor(req.params.board);
    if (!file || !existsSync(file)) return res.status(404).json({ error: 'not found' });
    const md = readFileSync(file, 'utf8');
    const before = parse(md);
    const items = before.filter((i) => i.id !== req.params.id);
    // Deleting an id that is not there used to answer 200, so a client could report a
    // successful delete that never happened. Say so instead.
    if (items.length === before.length) return res.status(404).json({ error: 'not found' });
    // Counter from the PRE-delete list, so the removed row's number is retired.
    save(file, serialize(md, items, refCounter(md, before)));
    res.json({ ok: true });
  });
}
