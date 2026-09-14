import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // `.env` must be read HERE, not inherited from the shell.
  //
  // server/index.ts imports dotenv; vite.config.ts does not, and vite does not load .env for you
  // before evaluating this file. So `process.env.PORT` was undefined here even when .env set it,
  // the proxy fell back to 4320, and the dev UI silently talked to whatever else was on that port
  // — another Command Center, most likely, since 4320 is this project's own default. The symptom
  // is the worst kind: the app loads and renders somebody else's data as though it were yours.
  //
  // loadEnv with an empty prefix returns every key in .env, not just VITE_*. That is safe because
  // nothing here reaches client code; it only configures the dev server.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const port = Number(env.PORT ?? 4320);

  return {
    plugins: [react()],
    server: {
      port: 5273,
      // Sections call their API on the same origin, so dev traffic is proxied to the Express
      // server started by `pnpm dev:server` — which reads PORT from the same .env.
      proxy: { '/api': `http://localhost:${port}` },
    },
  };
});
