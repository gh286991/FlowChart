import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import styles from "./home.module.scss";

export const metadata: Metadata = {
  title: "FlowChart｜把想法整理成清楚的脈絡",
  description: "一個結合心智圖、Markdown 筆記、結構整理與 MCP 的視覺化知識工作區。",
};

const featureCards = [
  {
    index: "01",
    title: "先看見結構，再補上內容",
    description: "從主題、分支到細節，畫面會替你保留脈絡。想法不再只是散落的段落，而是可以持續生長的系統。",
  },
  {
    index: "02",
    title: "筆記留在它真正屬於的位置",
    description: "每個節點都有自己的 Markdown 筆記，可貼圖片、整理清單，也能展開成完整工作區，不必在視窗之間來回切換。",
  },
  {
    index: "03",
    title: "自動化不需要接管你的思考",
    description: "節點助理只處理目前內容；整體助理只整理名稱與結構。範圍清楚、變更先預覽，最後決定權仍然在你。",
  },
] as const;

const processItems = [
  {
    title: "從一個中心主題開始",
    description: "先放下還不完整的想法，不需要在一開始就替每件事找到正確分類。",
  },
  {
    title: "讓分支長成可以理解的順序",
    description: "新增、拖曳、重新排序，或交給整體助理先提出一份結構變更建議。",
  },
  {
    title: "把研究與決策留在節點裡",
    description: "Markdown、圖片與對話都跟著節點保存，日後回來仍知道當初為什麼這樣整理。",
  },
] as const;

export default async function HomePage() {
  const user = await getCurrentUser();
  const workspaceHref = user ? "/dashboard" : "/register";
  const workspaceLabel = user ? "回到工作區" : "免費開始";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="FlowChart 首頁">
          <span className={styles.brandMark} aria-hidden="true"><span className={styles.brandLine} /></span>
          <span>FlowChart</span>
        </Link>

        <nav className={styles.nav} aria-label="首頁導覽">
          <a href="#workspace">產品</a>
          <a href="#features">功能</a>
          <a href="#workflow">工作方式</a>
          <a href="#scope">設計原則</a>
        </nav>

        <div className={styles.headerActions}>
          {!user && <Link href="/login" className={styles.buttonGhost}>登入</Link>}
          <Link href={workspaceHref} className={styles.button}>{workspaceLabel} <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Visual knowledge workspace</div>
          <h1>
            把想法拆開，
            <span>讓脈絡自然長出來。</span>
          </h1>
          <p className={styles.heroLead}>
            FlowChart 把心智圖、節點筆記與結構整理放在同一個工作區。
            從模糊的念頭到可以執行的計畫，你始終看得到全貌，也不會失去細節。
          </p>
          <div className={styles.heroActions}>
            <Link href={workspaceHref} className={styles.button}>{workspaceLabel} <span aria-hidden="true">→</span></Link>
            <a href="#workspace" className={styles.buttonGhost}>看看怎麼運作</a>
            <span className={styles.heroNote}>支援桌面與手機 · Markdown · MCP</span>
          </div>
        </div>

        <div className={styles.workspaceFrame} id="workspace" aria-label="FlowChart 工作區示意">
          <div className={styles.workspace}>
            <aside className={styles.sidebar} aria-hidden="true">
              <div className={styles.windowDots}><span /><span /><span /></div>
              <div className={styles.sidebarLabel}>Workspace</div>
              <div className={styles.sideItemActive}><span className={styles.sideIcon}>⌘</span>產品研究</div>
              <div className={styles.sideItem}><span className={styles.sideIcon}>◫</span>內容企劃</div>
              <div className={styles.sideItem}><span className={styles.sideIcon}>✓</span>上線清單</div>
              <div className={styles.sidebarLabel} style={{ marginTop: 24 }}>Recent</div>
              <div className={styles.sideItem}><span className={styles.sideIcon}>↗</span>訪談紀錄</div>
              <div className={styles.sideItem}><span className={styles.sideIcon}>#</span>靈感收集</div>
            </aside>

            <div className={styles.canvas} aria-hidden="true">
              <div className={styles.canvasTopbar}>
                <div className={styles.canvasTitle}>
                  <strong>新服務企劃</strong>
                  <span>剛剛自動儲存</span>
                </div>
                <div className={styles.canvasTools}><span>−</span><span>＋</span><span>⌖</span></div>
              </div>

              <svg className={styles.mapSvg} viewBox="0 0 700 610" preserveAspectRatio="none">
                <path d="M330 292 C250 292 225 155 135 155" />
                <path d="M330 315 C250 315 225 410 135 410" />
                <path d="M470 292 C530 292 535 125 620 125" />
                <path d="M470 305 C540 305 545 315 620 315" />
                <path d="M470 320 C535 320 545 485 620 485" />
              </svg>

              <div className={`${styles.node} ${styles.nodeOne}`}>使用者問題</div>
              <div className={`${styles.node} ${styles.nodeTwo}`}>市場與限制<span className={styles.nodeTag}>MD</span></div>
              <div className={`${styles.nodeRoot} ${styles.nodeRootPosition}`}>新服務企劃</div>
              <div className={`${styles.node} ${styles.nodeThree}`}>核心體驗</div>
              <div className={`${styles.node} ${styles.nodeFour}`}>功能範圍<span className={styles.nodeTag}>MD</span></div>
              <div className={`${styles.node} ${styles.nodeFive}`}>發布計畫</div>
            </div>

            <aside className={styles.notePanel} aria-hidden="true">
              <div className={styles.noteHeader}>
                <div><strong>節點筆記</strong><br /><span>功能範圍</span></div>
                <span>•••</span>
              </div>
              <div className={styles.noteTabs}><span>編輯</span><span>預覽</span><span>節點助理</span></div>
              <div className={styles.noteContent}>
                <h3>功能範圍</h3>
                <p>第一階段先解決整理與回顧，不急著加入所有協作功能。</p>
                <ul>
                  <li>節點可自由新增與重新排序</li>
                  <li>筆記支援 Markdown 與貼圖</li>
                  <li>手機可以快速查看與補充</li>
                </ul>
                <div className={styles.noteCallout}>決策原則：任何自動整理都先顯示變更預覽，再由使用者確認。</div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.trustRow} aria-label="產品特點摘要">
        <div className={styles.trustIntro}>不是另一個把所有功能塞在一起的白板，而是一個專注於「想清楚」的工作空間。</div>
        <div className={styles.trustItem}><span className={styles.trustNumber}>01</span>結構與筆記同步保存</div>
        <div className={styles.trustItem}><span className={styles.trustNumber}>02</span>資料範圍清楚可控</div>
        <div className={styles.trustItem}><span className={styles.trustNumber}>03</span>網頁與 MCP 共用內容</div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionKicker}>Built for clear thinking</div>
            <h2>工具退到背景，重要的脈絡才會留在眼前。</h2>
          </div>
          <div className={styles.featureGrid}>
            {featureCards.map((feature) => (
              <article key={feature.index} className={styles.featureCard}>
                <span className={styles.featureIndex}>{feature.index}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionTint} id="workflow">
        <div className={styles.sectionInner}>
          <div className={styles.processGrid}>
            <div className={styles.processCopy}>
              <div className={styles.sectionKicker}>A calmer workflow</div>
              <h2>從還沒想清楚，到有一條可以前進的路。</h2>
              <p>FlowChart 不要求你先完成分類。它讓你先留下內容，再逐步整理成主題、層級與下一步。</p>
              <div className={styles.processList}>
                {processItems.map((item, index) => (
                  <div className={styles.processItem} key={item.title}>
                    <span>0{index + 1}</span>
                    <div><strong>{item.title}</strong><p>{item.description}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.commandCard} aria-label="MCP 結構操作示意">
              <div className={styles.commandTop}><span>FlowChart MCP</span><span>Connected</span></div>
              <div className={styles.commandBody}>
                <div className={styles.commandPrompt}>› 在「發布計畫」下面新增測試、文件與正式上線三個節點，並把正式上線排在最後。</div>
                <div className={styles.commandTree}>
                  <div><span>●</span> 新服務企劃</div>
                  <div><span>└─</span> 發布計畫</div>
                  <div><span>├─</span> 測試</div>
                  <div><span>├─</span> 文件</div>
                  <div><span>└─</span> 正式上線</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.scopeSection} id="scope">
        <div className={styles.scopeIntro}>
          <div className={styles.sectionKicker}>Clear boundaries</div>
          <h2>需要協助時，它也只看必要的部分。</h2>
          <p>FlowChart 把節點內容與整體結構分開處理。你不需要為了整理順序，就把所有筆記、圖片與檔案一次交出去。</p>
        </div>
        <div className={styles.scopeCards}>
          <article className={styles.scopeCard}>
            <div className={styles.scopeCardTop}><h3>節點內的協作</h3><span className={styles.scopeBadge}>Local context</span></div>
            <p>只讀目前節點名稱、上層路徑與這個節點的 Markdown 筆記，用聊天方式提出改寫內容。</p>
            <div className={styles.scopeRule}>不讀其他節點筆記 · 不讀圖片原始資料 · 不改動整張圖</div>
          </article>
          <article className={styles.scopeCard}>
            <div className={styles.scopeCardTop}><h3>整張圖的整理</h3><span className={styles.scopeBadge}>Structure only</span></div>
            <p>只處理節點名稱、父子關係、左右分支與順序，適合新增、移動與重新組織整體架構。</p>
            <div className={styles.scopeRule}>不讀節點內文 · 所有變更先預覽 · 確認後才套用</div>
          </article>
          <article className={styles.scopeCard}>
            <div className={styles.scopeCardTop}><h3>從其他工具共同編輯</h3><span className={styles.scopeBadge}>MCP ready</span></div>
            <p>透過 MCP 讀寫相同的節點與 Markdown 筆記，讓開發工具、助理與網頁不再各自保存一份資料。</p>
            <div className={styles.scopeRule}>同一份結構 · 同一份筆記 · 權限與範圍可以被明確定義</div>
          </article>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaCard}>
          <div>
            <h2>下一個好想法，不必從一張空白文件開始。</h2>
            <p>先放下一個中心主題，讓內容、順序與細節在同一張圖上逐步成形。</p>
            <Link href={workspaceHref} className={styles.ctaButton}>{workspaceLabel} <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true"><span className={styles.brandLine} /></span>
          <span>FlowChart</span>
        </Link>
        <span>Visual thinking, notes and structure in one workspace.</span>
        <div className={styles.footerLinks}>
          <Link href={user ? "/dashboard" : "/login"}>{user ? "工作區" : "登入"}</Link>
          {!user && <Link href="/register">建立帳號</Link>}
        </div>
      </footer>
    </main>
  );
}
