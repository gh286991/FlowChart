import { appBaseUrl, oauthResource, OAUTH_SCOPES } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    resource: oauthResource(),
    authorization_servers: [appBaseUrl()],
    scopes_supported: OAUTH_SCOPES,
    resource_documentation: `${appBaseUrl()}/settings/mcp`
  }, {
    headers: { "cache-control": "public, max-age=300" }
  });
}
