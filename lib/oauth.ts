import { createHash, timingSafeEqual } from "node:crypto";

export const OAUTH_SCOPES = ["mcp:read", "mcp:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function oauthResource(): string {
  return `${appBaseUrl()}/mcp`;
}

export function normalizeScopes(value: string | null | undefined): OAuthScope[] {
  const requested = value?.trim() ? value.trim().split(/\s+/) : [...OAUTH_SCOPES];
  const unique = [...new Set(requested)];

  if (unique.some(scope => !OAUTH_SCOPES.includes(scope as OAuthScope))) {
    throw new Error("invalid_scope");
  }

  return OAUTH_SCOPES.filter(scope => unique.includes(scope));
}

export function hasScope(scopes: string[] | undefined, scope: OAuthScope): boolean {
  return Boolean(scopes?.includes(scope));
}

export function pkceS256(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
