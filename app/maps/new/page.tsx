import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";

export default async function NewMapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <SiteHeader name={user.name} email={user.email} />
      <main className="page-shell">
        <div className="page-heading">
          <div>
            <h1>新增心智圖</h1>
            <p>可只輸入名稱，也可貼上 Markdown 大綱直接轉成節點。</p>
          </div>
        </div>
        <section className="panel">
          <form className="auth-form" action="/api/maps" method="post">
            <div className="field">
              <label htmlFor="title">名稱</label>
              <input id="title" name="title" required maxLength={120} defaultValue="新的心智圖" />
            </div>
            <div className="field">
              <label htmlFor="outline">Markdown 大綱（選填）</label>
              <textarea id="outline" name="outline" rows={13} placeholder={"- 第一章\n  - 重點 A\n  - 重點 B\n- 第二章\n  - 待辦事項"} />
            </div>
            <button className="button button-primary" type="submit">建立並開啟</button>
          </form>
        </section>
      </main>
    </>
  );
}
