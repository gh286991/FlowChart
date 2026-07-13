import { appBaseUrl, OAUTH_SCOPES } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = appBaseUrl();

  return Response.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: OAUTH_SCOPES
  }, {
    headers: { "cache-control": "public, max-age=300" }
  });
}
