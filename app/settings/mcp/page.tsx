import { redirect } from "next/navigation";
import McpTokenManager from "@/components/McpTokenManager";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function McpSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tokens = await db.mcpToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true
    }
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const oauthConfigExample = JSON.stringify({
    mcpServers: {
      flowchart: { url: `${appUrl}/mcp` }
    }
  }, null, 2);
  const tokenConfigExample = JSON.stringify({
    mcpServers: {
      flowchart: {
        url: `${appUrl}/mcp`,
        headers: { Authorization: "Bearer fc_live_你的Token" }
      }
    }
  }, null, 2);

  return (
    <>
      <SiteHeader name={user.name} email={user.email} />
      <main className="page-shell">
        <div className="page-heading">
          <div>
            <h1>MCP 設定</h1>
            <p>ChatGPT 使用 OAuth 登入；Codex、Claude Desktop 等 Client 仍可使用個人 Token。</p>
          </div>
        </div>

        <section className="panel">
          <h2>ChatGPT OAuth 連線</h2>
          <p className="muted">在 ChatGPT 新增 MCP App 時只要填入 Endpoint，系統會自動開啟 FlowChart 登入與授權頁面。</p>
          <p className="muted">Endpoint：<span className="mono">{appUrl}/mcp</span></p>
          <pre className="code-block">{oauthConfigExample}</pre>
        </section>

        <section className="panel" style={{ marginTop: 24 }}>
          <h2>固定 Token（相容舊 Client）</h2>
          <p className="muted">Token 會將 MCP 操作綁定到目前帳號；完整 Token 只會顯示一次。</p>
          <McpTokenManager initialTokens={tokens.map(token => ({
            ...token,
            createdAt: token.createdAt.toISOString(),
            lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            revokedAt: token.revokedAt?.toISOString() ?? null
          }))} />
          <pre className="code-block" style={{ marginTop: 18 }}>{tokenConfigExample}</pre>
        </section>
      </main>
    </>
  );
}
