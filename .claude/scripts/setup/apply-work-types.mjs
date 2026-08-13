#!/usr/bin/env node
// Bake a role's work-type buckets into src/work-types.ts.
//
// Usage: .claude/scripts/setup/apply-work-types.mjs <role-key>
//        .claude/scripts/setup/apply-work-types.mjs --list
//
// Work types are the "what kind of work is this?" axis on a task, and the useful
// buckets depend on the role: an IC engineer's week splits into shipping /
// quality / support / growth, a manager's into delivery / capacity / engineering
// excellence, a PM's barely touches building at all. /setup asks for the role and
// calls this. The presets span the engineering ladder plus product and design —
// the board is not engineering-only.
//
// The output is ordinary TypeScript in YOUR repo, not config the dashboard reads
// at runtime — so it survives `pnpm update` of the @asucregonzalez packages, and
// you can hand-edit it afterwards. Re-running overwrites it.
//
// This file is the single source of truth for the presets. Node is already a
// prerequisite (the dashboard is a Vite app), so no jq or python needed.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = join(REPO_ROOT, 'src', 'work-types.ts');

/**
 * slug  — stable key, used internally
 * tag   — what gets written into the task title, e.g. `[Ship]`
 * name  — chip label
 * emoji — leading glyph, also accepted as a marker on its own
 * color — chip colour
 *
 * Within a preset, slug / tag / emoji must each be unique — the dashboard throws
 * on a duplicate rather than silently bucketing a task wrong.
 */
const PRESETS = {
  'ic-engineer': {
    blurb: 'Individual contributor — the four things that actually eat an engineer\'s week',
    types: [
      { slug: 'ship',    tag: 'Ship',    name: 'Ship',    emoji: '📦', color: '#06b6d4' },
      { slug: 'quality', tag: 'Quality', name: 'Quality', emoji: '🧪', color: '#22c55e' },
      { slug: 'support', tag: 'Support', name: 'Support', emoji: '🆘', color: '#f43f5e' },
      { slug: 'growth',  tag: 'Growth',  name: 'Growth',  emoji: '📚', color: '#8b5cf6' },
    ],
  },
  'senior-engineer': {
    blurb: 'Senior IC — still shipping, but design and review are now real slices',
    types: [
      { slug: 'delivery', tag: 'Delivery', name: 'Delivery', emoji: '📦', color: '#06b6d4' },
      { slug: 'design',   tag: 'Design',   name: 'Design',   emoji: '📐', color: '#6366f1' },
      { slug: 'review',   tag: 'Review',   name: 'Review',   emoji: '👀', color: '#22c55e' },
      { slug: 'eng',      tag: 'EngEx',    name: 'EngEx',    emoji: '⚙️', color: '#f59e0b' },
    ],
  },
  'tech-lead': {
    blurb: 'Tech lead — owns where the team is heading as well as what it ships',
    types: [
      { slug: 'delivery',  tag: 'Delivery',  name: 'Delivery',  emoji: '📦', color: '#06b6d4' },
      { slug: 'direction', tag: 'Direction', name: 'Direction', emoji: '🧭', color: '#6366f1' },
      { slug: 'review',    tag: 'Review',    name: 'Review',    emoji: '👀', color: '#22c55e' },
      { slug: 'eng',       tag: 'EngEx',     name: 'EngEx',     emoji: '⚙️', color: '#f59e0b' },
    ],
  },
  'engineering-manager': {
    blurb: 'Engineering manager — delivery, growing the team, keeping the platform healthy',
    types: [
      { slug: 'delivery', tag: 'Delivery', name: 'Delivery', emoji: '📦', color: '#06b6d4' },
      { slug: 'capacity', tag: 'Capacity', name: 'Capacity', emoji: '👥', color: '#8b5cf6' },
      { slug: 'eng',      tag: 'EngEx',    name: 'EngEx',    emoji: '⚙️', color: '#f59e0b' },
    ],
  },
  'staff-principal': {
    blurb: 'Staff / principal — most of the output is other people\'s output',
    types: [
      { slug: 'strategy', tag: 'Strategy', name: 'Strategy', emoji: '🧭', color: '#6366f1' },
      { slug: 'delivery', tag: 'Delivery', name: 'Delivery', emoji: '📦', color: '#06b6d4' },
      { slug: 'leverage', tag: 'Leverage', name: 'Leverage', emoji: '🤝', color: '#22c55e' },
      { slug: 'eng',      tag: 'EngEx',    name: 'EngEx',    emoji: '⚙️', color: '#f59e0b' },
    ],
  },
  'product-manager': {
    blurb: 'Product manager — the week goes on deciding and defining the thing, not building it',
    types: [
      { slug: 'definition', tag: 'Define',    name: 'Define',    emoji: '📋', color: '#6366f1' },
      { slug: 'discovery',  tag: 'Discovery', name: 'Discovery', emoji: '🔍', color: '#8b5cf6' },
      { slug: 'delivery',   tag: 'Delivery',  name: 'Delivery',  emoji: '📦', color: '#06b6d4' },
      { slug: 'align',      tag: 'Align',     name: 'Align',     emoji: '🤝', color: '#22c55e' },
    ],
  },
  'product-designer': {
    blurb: 'Product designer — the craft ships, but research and system work eat real slices',
    types: [
      { slug: 'delivery',  tag: 'Delivery',  name: 'Delivery',  emoji: '📦', color: '#06b6d4' },
      { slug: 'discovery', tag: 'Discovery', name: 'Discovery', emoji: '🔍', color: '#8b5cf6' },
      { slug: 'review',    tag: 'Review',    name: 'Review',    emoji: '👀', color: '#22c55e' },
      { slug: 'system',    tag: 'System',    name: 'System',    emoji: '🧩', color: '#f59e0b' },
    ],
  },
};

function usage(stream = process.stderr) {
  stream.write('Usage: apply-work-types.mjs <role-key>\n\nRoles:\n');
  for (const [key, p] of Object.entries(PRESETS)) {
    const tags = p.types.map((t) => `${t.emoji} ${t.name}`).join(' · ');
    stream.write(`  ${key.padEnd(21)} ${tags}\n${' '.repeat(23)} ${p.blurb}\n`);
  }
  stream.write('\nFor a set that is none of these, pick the closest and edit src/work-types.ts.\n');
}

const role = process.argv[2];

if (!role || role === '--help' || role === '-h') {
  usage(role ? process.stdout : process.stderr);
  process.exit(role ? 0 : 64);
}
if (role === '--list') {
  usage(process.stdout);
  process.exit(0);
}

const preset = PRESETS[role];
if (!preset) {
  process.stderr.write(`Unknown role "${role}".\n\n`);
  usage();
  process.exit(65);
}

// Pad the object literals into columns so the generated file reads like something
// a person would have written — it's meant to be edited by hand afterwards.
const width = (f) => Math.max(...preset.types.map((t) => JSON.stringify(t[f]).length));
const w = { slug: width('slug'), tag: width('tag'), name: width('name'), emoji: width('emoji') };
const rows = preset.types
  .map((t) => {
    // `key: "value",` padded as a whole, so the commas stay flush against values.
    const f = (k) => `${k}: ${JSON.stringify(t[k])},`.padEnd(k.length + w[k] + 3);
    return `  { ${f('slug')} ${f('tag')} ${f('name')} ${f('emoji')} color: ${JSON.stringify(t.color)} },`;
  })
  .join('\n');

const contents = `// Work types for this board — the "what kind of work is this?" axis on a task,
// shown as a chip and a filter in the Tasks tab and written into the task title
// as a bracket tag (\`[${preset.types[0].tag}]\`).
//
// GENERATED by .claude/scripts/setup/apply-work-types.mjs for role: ${role}
// (${preset.blurb})
//
// Yours to edit. Re-running the script overwrites the file, so if you change the
// buckets by hand, don't re-run it. Renaming a \`tag\` does NOT rewrite existing
// task lines — grep content/tasks/ for the old tag if you rename one.
//
// Constraints the dashboard enforces at startup: at least one entry, and unique
// slug / tag / emoji across the set.
import type { WorkTypeDef } from '@asucregonzalez/section-tasks';

export const WORK_TYPES: WorkTypeDef[] = [
${rows}
];
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, contents, 'utf-8');
process.stdout.write(`OK — wrote src/work-types.ts for role "${role}" (${preset.types.length} buckets)\n`);
