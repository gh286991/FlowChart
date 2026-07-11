import Link from "next/link";

export default function SiteHeader({ name, email }: { name?: string | null; email: string }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/dashboard">FlowChart</Link>
      <Link className="button button-ghost" href="/dashboard">心智圖</Link>
      <Link className="button button-ghost" href="/settings/mcp">MCP 設定</Link>
      <span className="header-user">{name || email}</span>
      <form action="/api/auth/logout" method="post">
        <button className="button" type="submit">登出</button>
      </form>
    </header>
  );
}
