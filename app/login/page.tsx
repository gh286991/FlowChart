import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>登入 FlowChart</h1>
        <p>登入後可管理自己的心智圖與 MCP Token。</p>
        {error && <div className="error-box">{error}</div>}
        <form className="auth-form" action="/api/auth/login" method="post">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">密碼</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" />
          </div>
          <button className="button button-primary" type="submit">登入</button>
        </form>
        <div className="auth-footer">還沒有帳號？ <Link href="/register">建立帳號</Link></div>
      </section>
    </main>
  );
}
