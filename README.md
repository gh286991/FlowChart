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
- `/settings/mcp`：產生與撤銷個人 MCP Token
- `/mcp`：MCP Streamable HTTP endpoint
- 密碼、Session、MCP Token 都不以明文儲存
- PM2 cluster mode、記憶體重啟與 GitHub Actions SSH 部署

## 資料庫

資料存放於 Cloudflare D1，資料表如下：

- `User`：帳號與 bcrypt 密碼雜湊
- `Session`：網頁登入 Session，只存 SHA-256 雜湊
- `McpToken`：個人 MCP Token，只存 SHA-256 雜湊、最後使用時間與撤銷時間
- `MindMap`：使用者、標題與 JSONB 心智圖資料

每次查詢與修改都包含 `userId` 條件，因此網頁 Session 與 MCP Token 都只能操作自己的心智圖。

## 本機啟動

```bash
nvm use
npm ci
npm run db:migrate:local
npm run preview
```

## MCP 使用方式

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
```
