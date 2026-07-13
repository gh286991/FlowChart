import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { oauthDb } from "@/lib/oauth-db";
import { normalizeScopes, oauthResource, type OAuthScope } from "@/lib/oauth";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function scopeLabel(scope: OAuthScope): string {
  return scope === "mcp:read"
    ? "讀取你的心智圖與帳號資訊"
    : "建立、編輯、刪除與重新排列心智圖";
}

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>無法授權</h1>
        <div className="error-box">{message}</div>
      </section>
    </main>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const clientId = first(params.client_id) || "";
  const redirectUri = first(params.redirect_uri) || "";
  const responseType = first(params.response_type) || "";
  const codeChallenge = first(params.code_challenge) || "";
  const codeChallengeMethod = first(params.code_challenge_method) || "";
  const state = first(params.state) || "";
  const resource = first(params.resource) || oauthResource();
  const scopeValue = first(params.scope);

  const client = clientId ? await oauthDb.findClient(clientId) : null;
  if (!client) return <ErrorCard message="找不到 OAuth Client。請回到 ChatGPT 重新連線。" />;
  if (!client.redirectUris.includes(redirectUri)) return <ErrorCard message="OAuth redirect URI 不在允許清單中。" />;
  if (responseType !== "code") return <ErrorCard message="目前只支援 OAuth authorization code flow。" />;
  if (!codeChallenge || codeChallengeMethod !== "S256") return <ErrorCard message="此連線必須使用 PKCE S256。" />;
  if (resource !== oauthResource()) return <ErrorCard message="OAuth resource 與 MCP endpoint 不一致。" />;

  let scopes: OAuthScope[];
  try {
    scopes = normalizeScopes(scopeValue);
  } catch {
    return <ErrorCard message="ChatGPT 要求了不支援的 OAuth scope。" />;
  }

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
    }
    redirect(`/login?returnTo=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>允許 ChatGPT 使用 FlowChart？</h1>
        <p><strong>{client.clientName}</strong> 將以 <strong>{user.email}</strong> 的身分存取 FlowChart。</p>

        <div className="panel" style={{ marginTop: 20, boxShadow: "none" }}>
          <h2 style={{ fontSize: 16 }}>要求的權限</h2>
          <ul>
            {scopes.map(scope => <li key={scope}>{scopeLabel(scope)}</li>)}
          </ul>
        </div>

        <form className="auth-form" action="/oauth/authorize/confirm" method="post">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
          <input type="hidden" name="resource" value={resource} />
          <input type="hidden" name="scope" value={scopes.join(" ")} />
          <input type="hidden" name="state" value={state} />
          <button className="button button-primary" type="submit" name="decision" value="approve">允許</button>
          <button className="button" type="submit" name="decision" value="deny">取消</button>
        </form>
      </section>
    </main>
  );
}
