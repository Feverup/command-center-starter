import ccPreset from '@andreasucreg/theme/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  // Design tokens (cyan/ink/surface/status colors, Lato, card shadows) that every
  // section's markup is written against. Without this preset the sections render
  // with no colors at all.
  presets: [ccPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Sections ship their own compiled markup — Tailwind must scan it or every
    // class only they use gets purged from your CSS.
    './node_modules/@andreasucreg/*/dist/**/*.js',
  ],
};
