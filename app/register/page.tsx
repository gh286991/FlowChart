import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>建立 FlowChart 帳號</h1>
        <p>第一版使用 Email 與密碼，不寄驗證信。</p>
        {error && <div className="error-box">{error}</div>}
        <form className="auth-form" action="/api/auth/register" method="post">
          <div className="field">
            <label htmlFor="name">顯示名稱</label>
            <input id="name" name="name" type="text" maxLength={60} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="password">密碼</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <button className="button button-primary" type="submit">註冊並登入</button>
        </form>
        <div className="auth-footer">已經有帳號？ <Link href="/login">回登入頁</Link></div>
      </section>
    </main>
  );
}
