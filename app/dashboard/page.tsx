import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MindMapData } from "@/lib/mind-map";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const maps = await db.mindMap.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <>
      <SiteHeader name={user.name} email={user.email} />
      <main className="page-shell">
        <div className="page-heading">
          <div>
            <h1>我的心智圖</h1>
            <p>每張心智圖都有獨立網址，也能由 MCP 建立與修改。</p>
          </div>
          <Link className="button button-primary" href="/maps/new">＋ 新增心智圖</Link>
        </div>

        <div className="map-grid">
          {maps.length === 0 && (
            <section className="panel">
              <h2>還沒有心智圖</h2>
              <p className="muted">從網頁新增，或先到 MCP 設定產生 Token。</p>
            </section>
          )}
          {maps.map(map => {
            const data = map.data as unknown as MindMapData;
            return (
              <article className="map-card" key={map.id}>
                <h2>{map.title}</h2>
                <div className="map-meta">{data.nodes.length} 個節點 · 更新於 {map.updatedAt.toLocaleString("zh-TW")}</div>
                <div className="map-actions">
                  <Link className="button button-primary" href={`/maps/${map.id}`}>開啟</Link>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
