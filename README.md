# FlowChart

可由瀏覽器與 MCP 共用的多人帳號心智圖服務。前端使用 Next.js App Router，資料存放於 PostgreSQL，正式環境以 PM2 cluster mode 執行。

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

舊版資料放在 Cloudflare Durable Object 內建儲存。新版改用 PostgreSQL，資料表如下：

- `User`：帳號與 bcrypt 密碼雜湊
- `Session`：網頁登入 Session，只存 SHA-256 雜湊
- `McpToken`：個人 MCP Token，只存 SHA-256 雜湊、最後使用時間與撤銷時間
- `MindMap`：使用者、標題與 JSONB 心智圖資料

每次查詢與修改都包含 `userId` 條件，因此網頁 Session 與 MCP Token 都只能操作自己的心智圖。

## 本機啟動

```bash
cp .env.example .env
export POSTGRES_PASSWORD='請換成強密碼'
docker compose -f docker-compose.db.yml up -d
npm install
npm run db:migrate
npm run dev
```

`.env` 範例：

```dotenv
DATABASE_URL="postgresql://flowchart:請換成強密碼@127.0.0.1:5432/flowchart?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_COOKIE_SECURE="false"
WEB_CONCURRENCY="2"
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

## PM2 部署

主機需求：Node.js 22、PM2 可執行環境、PostgreSQL，以及反向代理（建議 Nginx 或 Caddy）。

在主機專案目錄準備 `.env` 後：

```bash
bash scripts/deploy.sh
```

PM2 設定在 `ecosystem.config.cjs`：

- 預設 2 個 instance
- cluster mode
- 單 instance 超過 750 MB 自動重啟
- graceful shutdown 10 秒

查看狀態：

```bash
npx pm2 status
npx pm2 logs flowchart
curl http://127.0.0.1:3000/api/health
```

## GitHub Actions 正式部署

Repository Secrets：

- `DEPLOY_HOST`：Node 主機 IP 或網域
- `DEPLOY_USER`：SSH 使用者
- `DEPLOY_SSH_KEY`：私鑰內容
- `DEPLOY_PATH`：主機上的專案路徑，例如 `/srv/flowchart`

主機上的 `.env` 不會被 rsync 覆蓋。推送到 `main` 後，workflow 會上傳程式、執行 Prisma migration、build，再用 PM2 reload。

## Nginx 範例

```nginx
server {
  listen 80;
  server_name mindmap.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
  }
}
```
