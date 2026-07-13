import { oauthDb } from "@/lib/oauth-db";
import { oauthResource, pkceS256, safeEqual } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, {
    status,
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache"
    }
  });
}

function tokenResponse(tokens: Awaited<ReturnType<typeof oauthDb.issueTokens>>) {
  return Response.json({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: tokens.scopes.join(" ")
  }, {
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache"
    }
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const grantType = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  const resource = String(form.get("resource") || oauthResource());

  const client = clientId ? await oauthDb.findClient(clientId) : null;
  if (!client || client.tokenEndpointAuthMethod !== "none") {
    return tokenError("invalid_client", "Unknown OAuth client.", 401);
  }
  if (resource !== oauthResource()) {
    return tokenError("invalid_target", "The resource parameter must identify this MCP server.");
  }

  if (grantType === "authorization_code") {
    const code = String(form.get("code") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const codeVerifier = String(form.get("code_verifier") || "");
    if (!code || !redirectUri || !codeVerifier) {
      return tokenError("invalid_request", "code, redirect_uri, and code_verifier are required.");
    }

    const authorizationCode = await oauthDb.consumeAuthorizationCode(code);
    if (!authorizationCode) {
      return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used.");
    }
    if (authorizationCode.clientId !== clientId || authorizationCode.redirectUri !== redirectUri || authorizationCode.resource !== resource) {
      return tokenError("invalid_grant", "Authorization code does not match this client or resource.");
    }
    if (!safeEqual(pkceS256(codeVerifier), authorizationCode.codeChallenge)) {
      return tokenError("invalid_grant", "PKCE verification failed.");
    }

    return tokenResponse(await oauthDb.issueTokens({
      clientId,
      userId: authorizationCode.userId,
      resource,
      scopes: authorizationCode.scopes
    }));
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") || "");
    if (!refreshToken) return tokenError("invalid_request", "refresh_token is required.");

    const tokens = await oauthDb.rotateRefreshToken({ refreshToken, clientId, resource });
    if (!tokens) return tokenError("invalid_grant", "Refresh token is invalid, expired, or already used.");
    return tokenResponse(tokens);
  }

  return tokenError("unsupported_grant_type", "Only authorization_code and refresh_token are supported.");
}
