import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createOpaqueToken, sha256 } from "@/lib/security";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type OAuthScope
} from "@/lib/oauth";

type OAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: "none";
  createdAt: Date;
};

type AuthorizationCode = {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  resource: string;
  scopes: OAuthScope[];
  expiresAt: Date;
};

type OAuthAccessToken = {
  clientId: string;
  userId: string;
  resource: string;
  scopes: OAuthScope[];
  expiresAt: Date;
};

type OAuthRefreshToken = OAuthAccessToken;

const isoNow = () => new Date().toISOString();
const parseScopes = (value: unknown) => String(value || "").split(/\s+/).filter(Boolean) as OAuthScope[];

async function d1(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB as D1Database;
}

function clientFrom(row: Record<string, unknown>): OAuthClient {
  return {
    clientId: String(row.client_id),
    clientName: String(row.client_name),
    redirectUris: JSON.parse(String(row.redirect_uris)) as string[],
    tokenEndpointAuthMethod: "none",
    createdAt: new Date(String(row.created_at))
  };
}

function authorizationCodeFrom(row: Record<string, unknown>): AuthorizationCode {
  return {
    clientId: String(row.client_id),
    userId: String(row.user_id),
    redirectUri: String(row.redirect_uri),
    codeChallenge: String(row.code_challenge),
    codeChallengeMethod: "S256",
    resource: String(row.resource),
    scopes: parseScopes(row.scope),
    expiresAt: new Date(String(row.expires_at))
  };
}

function accessTokenFrom(row: Record<string, unknown>): OAuthAccessToken {
  return {
    clientId: String(row.client_id),
    userId: String(row.user_id),
    resource: String(row.resource),
    scopes: parseScopes(row.scope),
    expiresAt: new Date(String(row.expires_at))
  };
}

function refreshTokenFrom(row: Record<string, unknown>): OAuthRefreshToken {
  return accessTokenFrom(row);
}

async function issueTokenPair(data: {
  clientId: string;
  userId: string;
  resource: string;
  scopes: OAuthScope[];
}) {
  const database = await d1();
  const accessToken = createOpaqueToken("fc_access");
  const refreshToken = createOpaqueToken("fc_refresh");
  const createdAt = isoNow();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
  const scope = data.scopes.join(" ");

  await database.batch([
    database.prepare(
      "INSERT INTO oauth_access_tokens (id,token_hash,client_id,user_id,resource,scope,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(), sha256(accessToken), data.clientId, data.userId, data.resource, scope, accessExpiresAt, createdAt),
    database.prepare(
      "INSERT INTO oauth_refresh_tokens (id,token_hash,client_id,user_id,resource,scope,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(crypto.randomUUID(), sha256(refreshToken), data.clientId, data.userId, data.resource, scope, refreshExpiresAt, createdAt)
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scopes: data.scopes
  };
}

export const oauthDb = {
  async registerClient(input: { clientName: string; redirectUris: string[] }): Promise<OAuthClient> {
    const database = await d1();
    const clientId = createOpaqueToken("fc_client");
    const createdAt = isoNow();

    await database.prepare(
      "INSERT INTO oauth_clients (client_id,client_name,redirect_uris,token_endpoint_auth_method,created_at) VALUES (?,?,?,?,?)"
    ).bind(clientId, input.clientName, JSON.stringify(input.redirectUris), "none", createdAt).run();

    return {
      clientId,
      clientName: input.clientName,
      redirectUris: input.redirectUris,
      tokenEndpointAuthMethod: "none",
      createdAt: new Date(createdAt)
    };
  },

  async findClient(clientId: string): Promise<OAuthClient | null> {
    const row = await (await d1()).prepare(
      "SELECT * FROM oauth_clients WHERE client_id=? LIMIT 1"
    ).bind(clientId).first<Record<string, unknown>>();
    return row ? clientFrom(row) : null;
  },

  async createAuthorizationCode(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    resource: string;
    scopes: OAuthScope[];
  }): Promise<string> {
    const database = await d1();
    const code = createOpaqueToken("fc_code");
    const createdAt = isoNow();
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString();

    await database.prepare(
      "INSERT INTO oauth_authorization_codes (id,code_hash,client_id,user_id,redirect_uri,code_challenge,code_challenge_method,resource,scope,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(),
      sha256(code),
      input.clientId,
      input.userId,
      input.redirectUri,
      input.codeChallenge,
      "S256",
      input.resource,
      input.scopes.join(" "),
      expiresAt,
      createdAt
    ).run();

    return code;
  },

  async consumeAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
    const database = await d1();
    const now = isoNow();
    const row = await database.prepare(
      "SELECT * FROM oauth_authorization_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>? LIMIT 1"
    ).bind(sha256(code), now).first<Record<string, unknown>>();
    if (!row) return null;

    const result = await database.prepare(
      "UPDATE oauth_authorization_codes SET used_at=? WHERE id=? AND used_at IS NULL"
    ).bind(now, String(row.id)).run();
    if ((result.meta.changes ?? 0) !== 1) return null;
    return authorizationCodeFrom(row);
  },

  async issueTokens(input: {
    clientId: string;
    userId: string;
    resource: string;
    scopes: OAuthScope[];
  }) {
    return issueTokenPair(input);
  },

  async rotateRefreshToken(input: {
    refreshToken: string;
    clientId: string;
    resource: string;
  }) {
    const database = await d1();
    const now = isoNow();
    const row = await database.prepare(
      "SELECT * FROM oauth_refresh_tokens WHERE token_hash=? AND client_id=? AND resource=? AND revoked_at IS NULL AND expires_at>? LIMIT 1"
    ).bind(sha256(input.refreshToken), input.clientId, input.resource, now).first<Record<string, unknown>>();
    if (!row) return null;

    const result = await database.prepare(
      "UPDATE oauth_refresh_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL"
    ).bind(now, String(row.id)).run();
    if ((result.meta.changes ?? 0) !== 1) return null;

    return issueTokenPair(refreshTokenFrom(row));
  },

  async findAccessToken(token: string, resource: string): Promise<OAuthAccessToken | null> {
    const database = await d1();
    const now = isoNow();
    const row = await database.prepare(
      "SELECT * FROM oauth_access_tokens WHERE token_hash=? AND resource=? AND revoked_at IS NULL AND expires_at>? LIMIT 1"
    ).bind(sha256(token), resource, now).first<Record<string, unknown>>();

    if (!row) return null;
    await database.prepare(
      "UPDATE oauth_access_tokens SET last_used_at=? WHERE id=?"
    ).bind(now, String(row.id)).run();
    return accessTokenFrom(row);
  }
};
