import { getCloudflareContext } from "@opennextjs/cloudflare";

type User = { id: string; email: string; name: string | null; passwordHash: string; createdAt: Date; updatedAt: Date };
type Session = { id: string; tokenHash: string; expiresAt: Date; createdAt: Date; userId: string };
type MindMap = { id: string; title: string; data: unknown; createdAt: Date; updatedAt: Date; userId: string };
type McpToken = { id: string; name: string; tokenHash: string; tokenPrefix: string; lastUsedAt: Date | null; revokedAt: Date | null; createdAt: Date; userId: string };

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const date = (value: string | null) => value ? new Date(value) : null;

async function d1(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB as D1Database;
}

export async function pingDatabase() {
  await (await d1()).prepare("SELECT 1").first();
}

function userFrom(row: Record<string, unknown>): User { return { id: String(row.id), email: String(row.email), name: row.name ? String(row.name) : null, passwordHash: String(row.password_hash), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)) }; }
function sessionFrom(row: Record<string, unknown>): Session { return { id: String(row.id), tokenHash: String(row.token_hash), expiresAt: new Date(String(row.expires_at)), createdAt: new Date(String(row.created_at)), userId: String(row.user_id) }; }
function mapFrom(row: Record<string, unknown>): MindMap { return { id: String(row.id), title: String(row.title), data: JSON.parse(String(row.data)), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)), userId: String(row.user_id) }; }
function tokenFrom(row: Record<string, unknown>): McpToken { return { id: String(row.id), name: String(row.name), tokenHash: String(row.token_hash), tokenPrefix: String(row.token_prefix), lastUsedAt: date(row.last_used_at ? String(row.last_used_at) : null), revokedAt: date(row.revoked_at ? String(row.revoked_at) : null), createdAt: new Date(String(row.created_at)), userId: String(row.user_id) }; }

async function findMap(where: { id: string; userId?: string }) {
  const database = await d1();
  const row = where.userId
    ? await database.prepare("SELECT * FROM mind_maps WHERE id=? AND user_id=? LIMIT 1").bind(where.id, where.userId).first<Record<string, unknown>>()
    : await database.prepare("SELECT * FROM mind_maps WHERE id=? LIMIT 1").bind(where.id).first<Record<string, unknown>>();
  return row ? mapFrom(row) : null;
}

export const db = {
  user: {
    async create({ data }: { data: { name: string | null; email: string; passwordHash: string } }) { const database = await d1(); const userId = id(); const stamp = now(); await database.prepare("INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(userId, data.email, data.name, data.passwordHash, stamp, stamp).run(); return { id: userId, ...data, createdAt: new Date(stamp), updatedAt: new Date(stamp) }; },
    async findUnique({ where }: { where: { email?: string } }) { if (!where.email) return null; const row = await (await d1()).prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(where.email).first<Record<string, unknown>>(); return row ? userFrom(row) : null; }
  },
  session: {
    async create({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) { const database = await d1(); const sessionId = id(); const stamp = now(); await database.prepare("INSERT INTO sessions (id,token_hash,expires_at,created_at,user_id) VALUES (?,?,?,?,?)").bind(sessionId, data.tokenHash, data.expiresAt.toISOString(), stamp, data.userId).run(); return { id: sessionId, ...data, createdAt: new Date(stamp) }; },
    async findUnique({ where, include }: { where: { tokenHash: string }; include?: { user?: boolean } }) { const row = await (await d1()).prepare("SELECT s.*,u.email,u.name,u.password_hash,u.created_at AS user_created_at,u.updated_at AS user_updated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? LIMIT 1").bind(where.tokenHash).first<Record<string, unknown>>(); if (!row) return null; const session = sessionFrom(row); return include?.user ? { ...session, user: { id: session.userId, email: String(row.email), name: row.name ? String(row.name) : null, passwordHash: String(row.password_hash), createdAt: new Date(String(row.user_created_at)), updatedAt: new Date(String(row.user_updated_at)) } } : session; },
    async delete({ where }: { where: { id: string } }) { await (await d1()).prepare("DELETE FROM sessions WHERE id=?").bind(where.id).run(); },
    async deleteMany({ where }: { where: { tokenHash: string } }) { const result = await (await d1()).prepare("DELETE FROM sessions WHERE token_hash=?").bind(where.tokenHash).run(); return { count: result.meta.changes ?? 0 }; }
  },
  mindMap: {
    async findMany({ where }: { where: { userId: string }; orderBy?: unknown; select?: unknown }) { const rows = await (await d1()).prepare("SELECT * FROM mind_maps WHERE user_id=? ORDER BY updated_at DESC").bind(where.userId).all<Record<string, unknown>>(); return rows.results.map(mapFrom); },
    async findFirst({ where }: { where: { id: string; userId?: string }; select?: unknown }) { return findMap(where); },
    async create({ data }: { data: { userId: string; title: string; data: unknown } }) { const database = await d1(); const mapId = id(); const stamp = now(); await database.prepare("INSERT INTO mind_maps (id,title,data,created_at,updated_at,user_id) VALUES (?,?,?,?,?,?)").bind(mapId, data.title, JSON.stringify(data.data), stamp, stamp, data.userId).run(); return { id: mapId, ...data, createdAt: new Date(stamp), updatedAt: new Date(stamp) }; },
    async update({ where, data }: { where: { id: string }; data: { title?: string; data?: unknown } }) { const existing = await findMap(where); if (!existing) throw new Error("map not found"); const title = data.title ?? existing.title; const content = data.data ?? existing.data; const stamp = now(); await (await d1()).prepare("UPDATE mind_maps SET title=?,data=?,updated_at=? WHERE id=?").bind(title, JSON.stringify(content), stamp, where.id).run(); return { ...existing, title, data: content, updatedAt: new Date(stamp) }; },
    async deleteMany({ where }: { where: { id: string; userId: string } }) { const result = await (await d1()).prepare("DELETE FROM mind_maps WHERE id=? AND user_id=?").bind(where.id, where.userId).run(); return { count: result.meta.changes ?? 0 }; }
  },
  mcpToken: {
    async create({ data }: { data: { name: string; tokenHash: string; tokenPrefix: string; userId: string }; select?: unknown }) { const database = await d1(); const tokenId = id(); const stamp = now(); await database.prepare("INSERT INTO mcp_tokens (id,name,token_hash,token_prefix,created_at,user_id) VALUES (?,?,?,?,?,?)").bind(tokenId, data.name, data.tokenHash, data.tokenPrefix, stamp, data.userId).run(); return { id: tokenId, ...data, createdAt: new Date(stamp), lastUsedAt: null, revokedAt: null }; },
    async findMany({ where }: { where: { userId: string }; orderBy?: unknown; select?: unknown }) { const rows = await (await d1()).prepare("SELECT * FROM mcp_tokens WHERE user_id=? ORDER BY created_at DESC").bind(where.userId).all<Record<string, unknown>>(); return rows.results.map(tokenFrom); },
    async findFirst({ where }: { where: { tokenHash: string; revokedAt?: null }; select?: unknown }) { const row = await (await d1()).prepare("SELECT * FROM mcp_tokens WHERE token_hash=? AND revoked_at IS NULL LIMIT 1").bind(where.tokenHash).first<Record<string, unknown>>(); return row ? tokenFrom(row) : null; },
    async update({ where, data }: { where: { id: string }; data: { lastUsedAt?: Date; revokedAt?: Date | null } }) { if (data.lastUsedAt) await (await d1()).prepare("UPDATE mcp_tokens SET last_used_at=? WHERE id=?").bind(data.lastUsedAt.toISOString(), where.id).run(); if (data.revokedAt !== undefined) await (await d1()).prepare("UPDATE mcp_tokens SET revoked_at=? WHERE id=?").bind(data.revokedAt?.toISOString() ?? null, where.id).run(); return true; },
    async updateMany({ where, data }: { where: { id: string; userId: string; revokedAt?: null }; data: { revokedAt: Date } }) { const result = await (await d1()).prepare("UPDATE mcp_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(data.revokedAt.toISOString(), where.id, where.userId).run(); return { count: result.meta.changes ?? 0 }; }
  }
};
