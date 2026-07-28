import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    // Sections call their API on the same origin, so dev traffic is proxied to
    // the Express server started by `pnpm dev:server`.
    proxy: { '/api': 'http://localhost:4320' },
  },
});
