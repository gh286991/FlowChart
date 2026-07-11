"use client";

import { useState } from "react";

type TokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export default function McpTokenManager({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("我的 MCP");
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createToken = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "建立失敗");
      setPlainToken(result.token);
      setTokens(current => [result.record, ...current]);
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async (id: string) => {
    const response = await fetch(`/api/mcp-tokens/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setTokens(current => current.map(token => token.id === id ? { ...token, revokedAt: new Date().toISOString() } : token));
  };

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2>新增個人 MCP Token</h2>
        <p className="muted">每組 Token 只屬於目前帳號。伺服器只保存雜湊，完整 Token 只會顯示這一次。</p>
        <div className="form-row">
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Token 名稱" />
          <button className="button button-primary" onClick={createToken} disabled={busy || !name.trim()}>
            {busy ? "建立中…" : "產生 Token"}
          </button>
        </div>
        {plainToken && (
          <div className="token-reveal">
            <strong>請立刻複製保存</strong>
            <textarea readOnly value={plainToken} rows={3} onFocus={event => event.currentTarget.select()} />
            <button className="button" onClick={() => void navigator.clipboard.writeText(plainToken)}>複製</button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>已建立的 Token</h2>
        <div className="token-list">
          {tokens.length === 0 && <p className="empty">尚未建立 Token。</p>}
          {tokens.map(token => (
            <div className="token-row" key={token.id}>
              <div>
                <strong>{token.name}</strong>
                <div className="muted mono">{token.tokenPrefix}••••••••</div>
                <small className="muted">
                  建立：{new Date(token.createdAt).toLocaleString("zh-TW")}
                  {token.lastUsedAt ? ` · 最後使用：${new Date(token.lastUsedAt).toLocaleString("zh-TW")}` : " · 尚未使用"}
                </small>
              </div>
              {token.revokedAt ? <span className="badge">已撤銷</span> : (
                <button className="button button-danger" onClick={() => revokeToken(token.id)}>撤銷</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
