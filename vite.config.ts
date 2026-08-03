import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    // Sections call their API on the same origin, so dev traffic is proxied to
    // the Express server started by `pnpm dev:server`.
    //
    // Read from PORT, the same variable server/index.ts uses. It was hardcoded to
    // 4320 while the server honoured PORT, so setting PORT — to avoid a clash with
    // something already on 4320 — left the proxy pointing at whatever else was
    // there, or nothing. Every API call then failed with no obvious cause.
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 4320}` },
  },
});
