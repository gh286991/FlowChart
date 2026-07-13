import { oauthDb } from "@/lib/oauth-db";
import { OAUTH_SCOPES } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistrationRequest = {
  client_name?: unknown;
  redirect_uris?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
};

function registrationError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: RegistrationRequest;
  try {
    body = await request.json() as RegistrationRequest;
  } catch {
    return registrationError("invalid_client_metadata", "Request body must be valid JSON.");
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((value): value is string => typeof value === "string")
    : [];

  if (!redirectUris.length || redirectUris.some(uri => !isAllowedRedirectUri(uri))) {
    return registrationError("invalid_redirect_uri", "At least one valid HTTPS redirect URI is required.");
  }

  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
    return registrationError("invalid_client_metadata", "Only public clients using token_endpoint_auth_method=none are supported.");
  }

  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
  const responseTypes = Array.isArray(body.response_types) ? body.response_types : ["code"];
  if (grantTypes.some(value => value !== "authorization_code" && value !== "refresh_token") || responseTypes.some(value => value !== "code")) {
    return registrationError("invalid_client_metadata", "Only authorization_code, refresh_token, and response_type=code are supported.");
  }

  const client = await oauthDb.registerClient({
    clientName: typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 120) : "ChatGPT MCP Client",
    redirectUris: [...new Set(redirectUris)]
  });

  return Response.json({
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: OAUTH_SCOPES.join(" ")
  }, {
    status: 201,
    headers: { "cache-control": "no-store" }
  });
}
