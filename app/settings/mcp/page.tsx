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
  const configExample = JSON.stringify({
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
            <p>Token 會將 MCP 操作綁定到目前帳號；不同使用者看不到彼此資料。</p>
          </div>
        </div>

        <McpTokenManager initialTokens={tokens.map(token => ({
          ...token,
          createdAt: token.createdAt.toISOString(),
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          revokedAt: token.revokedAt?.toISOString() ?? null
        }))} />

        <section className="panel" style={{ marginTop: 24 }}>
          <h2>MCP 連線資料</h2>
          <p className="muted">Endpoint：<span className="mono">{appUrl}/mcp</span></p>
          <pre className="code-block">{configExample}</pre>
        </section>
      </main>
    </>
  );
}
