import { getCurrentUser } from "@/lib/auth";
import { oauthDb } from "@/lib/oauth-db";
import { normalizeScopes, oauthResource } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToClient(redirectUri: string, values: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return Response.redirect(url, 303);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const clientId = String(form.get("client_id") || "");
  const redirectUri = String(form.get("redirect_uri") || "");
  const codeChallenge = String(form.get("code_challenge") || "");
  const codeChallengeMethod = String(form.get("code_challenge_method") || "");
  const resource = String(form.get("resource") || "");
  const scope = String(form.get("scope") || "");
  const state = String(form.get("state") || "");
  const decision = String(form.get("decision") || "deny");

  const client = await oauthDb.findClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (decision !== "approve") {
    return redirectToClient(redirectUri, { error: "access_denied", state });
  }

  const user = await getCurrentUser();
  if (!user) {
    return redirectToClient(redirectUri, { error: "login_required", state });
  }

  if (!codeChallenge || codeChallengeMethod !== "S256" || resource !== oauthResource()) {
    return redirectToClient(redirectUri, { error: "invalid_request", state });
  }

  let scopes;
  try {
    scopes = normalizeScopes(scope);
  } catch {
    return redirectToClient(redirectUri, { error: "invalid_scope", state });
  }

  const code = await oauthDb.createAuthorizationCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    resource,
    scopes
  });

  return redirectToClient(redirectUri, { code, state });
}
