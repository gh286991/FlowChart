# FlowChart

可由瀏覽器與 MCP 共用的多人帳號心智圖服務。前端使用 Next.js App Router，正式環境部署到 Cloudflare Workers，資料存放於 Cloudflare D1。

## 已完成

- `/register`：Email／密碼註冊
- `/login`：登入
- `/dashboard`：只顯示目前使用者的心智圖
- `/maps/new`：建立心智圖或將 Markdown 大綱轉成節點
- `/maps/[id]`：每張心智圖都有自己的 router
- XMind 式雙向、向左、向右自動排列
- 拖曳畫布、縮放、拖曳節點、Minimap
- Cloudflare Workers AI：節點研究、任務拆分、Markdown／文件整理
- AI 建議先預覽，確認後才加入目前選取的節點
- `/settings/mcp`：管理 MCP OAuth 與固定 Token
- `/mcp`：MCP Streamable HTTP endpoint
- ChatGPT OAuth 2.1：Protected Resource Metadata、Authorization Server Metadata、DCR、PKCE、Refresh Token Rotation
- 密碼、Session、MCP Token 與 OAuth Token 都不以明文儲存

## Cloudflare Workers AI

心智圖編輯器選取節點後，按下「Cloudflare AI」即可使用：

- **找資料**：根據目前節點、上層脈絡與最多三個參考網址產生研究摘要與建議節點。
- **拆分任務**：產生可執行任務、估算、相依關係與驗收條件。
- **整理文件**：貼上 Markdown／文字，或上傳最大 10 MB 的文件，透過 `env.AI.toMarkdown()` 轉換後整理成心智圖大綱。

AI API 都需要目前的網頁登入 Session：

- `POST /api/ai/node/research`
- `POST /api/ai/node/tasks`
- `POST /api/ai/markdown/organize`

Wrangler 使用 `AI` binding，預設模型為：

```text
@cf/meta/llama-3.1-8b-instruct-fast
```

可在 `wrangler.jsonc` 的 `AI_MODEL` 修改。研究網址會限制回應大小、重新導向次數，並阻擋明顯的 localhost／私有網路位址。詳細設計見 `docs/AI_V1_DESIGN.md`。

## 資料庫

資料存放於 Cloudflare D1，主要資料表如下：

- `users`：帳號與 bcrypt 密碼雜湊
- `sessions`：網頁登入 Session，只存 SHA-256 雜湊
- `mcp_tokens`：個人固定 MCP Token，只存 SHA-256 雜湊、最後使用時間與撤銷時間
- `mind_maps`：使用者、標題與 JSON 心智圖資料
- `oauth_clients`：透過 Dynamic Client Registration 建立的 OAuth Client
- `oauth_authorization_codes`：短效且只能使用一次的 Authorization Code
- `oauth_access_tokens`：綁定 `/mcp` resource 與 scope 的短效 Access Token
- `oauth_refresh_tokens`：每次使用後旋轉並撤銷舊 Token

每次查詢與修改都包含 `userId` 條件，因此網頁 Session、固定 MCP Token 與 OAuth Token 都只能操作自己的心智圖。

## 本機啟動

```bash
nvm use
npm ci
npm run db:migrate:local
npm run preview
```

Workers AI 必須透過 Wrangler／OpenNext preview 使用遠端 AI binding；一般 `next dev` 不會提供 `env.AI`。

## ChatGPT MCP OAuth

ChatGPT 新增 MCP App 時填入：

```text
https://你的網域/mcp
```

不需要手動貼 Bearer Token。未登入的 MCP 請求會透過 `WWW-Authenticate` 指向 Protected Resource Metadata，接著由 ChatGPT 自動執行 Dynamic Client Registration、Authorization Code + PKCE 與 Token Exchange。

OAuth endpoints：

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/token`

Scopes：

- `mcp:read`：讀取帳號與心智圖
- `mcp:write`：建立、修改、刪除與重新排列心智圖

## 固定 MCP Token（舊 Client 相容）

1. 註冊並登入網頁。
2. 開啟 `/settings/mcp`。
3. 產生個人 Token，完整內容只會顯示一次。
4. MCP Client 連到 `https://你的網域/mcp`，並帶上：

```http
Authorization: Bearer fc_live_xxxxxxxxx
```

MCP 工具：

- `whoami`
- `list_maps`
- `create_map`
- `get_map`
- `add_node`
- `update_node`
- `delete_node`
- `auto_layout`

`create_map`、`add_node` 等操作都會回傳可直接開啟的 `/maps/{id}` 網址。

## Cloudflare 部署

需求：Node.js 22、已登入 Wrangler（`npx wrangler whoami`），以及 `wrangler.jsonc` 中已設定的 D1 database ID。

發布會先套用遠端 D1 migrations，再建置並部署 OpenNext Worker：

```bash
bash scripts/deploy.sh
```

也可以直接執行：

```bash
npm run deploy
```

驗證：

```bash
curl --fail https://flowchart-next.gh286991.workers.dev/api/health
curl --fail https://flowchart-next.gh286991.workers.dev/.well-known/oauth-protected-resource
```
