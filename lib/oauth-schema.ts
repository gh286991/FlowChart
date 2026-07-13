import { getCloudflareContext } from "@opennextjs/cloudflare";

let schemaPromise: Promise<void> | null = null;

async function getDatabase(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("Cloudflare D1 binding DB is missing");
  return env.DB as D1Database;
}

async function createOAuthTables(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
        created_at TEXT NOT NULL
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redirect_uri TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        code_challenge_method TEXT NOT NULL,
        resource TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used_at TEXT
      )
    `),
    database.prepare("CREATE INDEX IF NOT EXISTS oauth_authorization_codes_expiry_idx ON oauth_authorization_codes(expires_at)"),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_access_tokens (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT
      )
    `),
    database.prepare("CREATE INDEX IF NOT EXISTS oauth_access_tokens_lookup_idx ON oauth_access_tokens(token_hash, resource)"),
    database.prepare("CREATE INDEX IF NOT EXISTS oauth_access_tokens_expiry_idx ON oauth_access_tokens(expires_at)"),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        scope TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT
      )
    `),
    database.prepare("CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_lookup_idx ON oauth_refresh_tokens(token_hash, client_id, resource)"),
    database.prepare("CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_expiry_idx ON oauth_refresh_tokens(expires_at)")
  ]);
}

export async function ensureOAuthSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = getDatabase()
      .then(createOAuthTables)
      .catch(error => {
        schemaPromise = null;
        throw error;
      });
  }

  await schemaPromise;
}
