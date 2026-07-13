interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  AI: unknown;
  NEXT_PUBLIC_APP_URL: string;
  SESSION_COOKIE_SECURE: string;
  AI_MODEL: string;
  AI_SEARCH?: unknown;
  AI_SEARCH_INSTANCE?: string;
}
