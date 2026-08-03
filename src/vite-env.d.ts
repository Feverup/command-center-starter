/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Your name, from VITE_OWNER_NAME in .env. Decides which meeting action items
   * count as yours; with it unset, none do — see src/App.tsx and HomeView.
   */
  readonly VITE_OWNER_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
