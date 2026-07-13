# FlowChart Cloudflare Workers AI v1

## 目標

選取心智圖節點後，使用 Cloudflare Workers AI 完成三種工作：

1. **節點研究**：使用節點、上層脈絡、使用者提供的網址與模型既有知識，產生摘要和建議節點。
2. **任務拆分**：產生任務、描述、驗收條件、估算與相依關係。
3. **Markdown／文件整理**：整理 Markdown，或先用 `env.AI.toMarkdown()` 轉換文件，再產生樹狀大綱。

AI 結果只在右側面板預覽；使用者按下「加入目前節點」後，才會寫入心智圖 JSON 並透過既有 API 儲存。

## Runtime

目前專案是 Next.js App Router，透過 OpenNext 部署到 Cloudflare Workers。AI binding 由 `wrangler.jsonc` 提供：

```jsonc
"ai": {
  "binding": "AI",
  "remote": true
}
```

Server route 透過 `getCloudflareContext({ async: true })` 取得 `env.AI`。

預設模型：

```text
@cf/meta/llama-3.1-8b-instruct-fast
```

此模型支援 Workers AI JSON Mode。API 使用 JSON Schema 結構化輸出，格式為：

```ts
response_format: {
  type: "json_schema",
  json_schema: schema
}
```

## API

所有 AI endpoint 都會先檢查目前登入 Session，匿名請求回傳 `401`。

### `POST /api/ai/node/research`

```json
{
  "nodeText": "Cloudflare Workers AI",
  "branchContext": ["FlowChart", "AI 功能"],
  "question": "適合心智圖的結構化輸出方式",
  "sourceUrls": ["https://developers.cloudflare.com/workers-ai/features/json-mode/"],
  "maxSuggestions": 6
}
```

### `POST /api/ai/node/tasks`

```json
{
  "nodeText": "加入 AI 節點研究功能",
  "branchContext": ["FlowChart", "AI v1"],
  "constraints": ["使用 Cloudflare Workers AI", "不得直接寫入節點"],
  "maxTasks": 8
}
```

### `POST /api/ai/markdown/organize`

JSON：

```json
{
  "content": "# 原始內容...",
  "instruction": "整理成 Podcast 訪綱",
  "maxDepth": 4
}
```

也支援 `multipart/form-data` 的 `file`，最大 10 MB。Markdown／純文字直接讀取；其他支援格式透過 `env.AI.toMarkdown()` 轉換。

## 心智圖資料

AI 產生的節點除了標題，還可保存：

- `note`
- `kind`
- `sourceUrls`

舊心智圖沒有這些欄位仍可正常載入。畫布會在含 AI 補充內容的節點顯示小型 `AI` 標記，詳細內容目前保存在 JSON 中。

## 網址讀取保護

研究功能最多接受三個網址，並套用：

- 只允許 HTTP／HTTPS。
- 阻擋含帳密的 URL。
- 阻擋明顯的 localhost、私有 IPv4、link-local 與私有 IPv6 位址。
- 每個來源 8 秒 timeout。
- 最多三次重新導向，每次都重新驗證目標網址。
- 最大讀取 240 KB，送入模型最多 14,000 字元。
- 只接受 HTML、純文字、Markdown、JSON 與 XML。

這些限制降低 SSRF 與成本風險，但不是完整的 DNS rebinding 防護。正式大量開放前仍建議加入使用者級 rate limit 與 AI 使用紀錄。

## 後續版本

- 顯示節點 `note` 與引用來源的完整側欄。
- 讓使用者逐項勾選 AI 建議後再套用。
- 以 D1 建立每分鐘／每日配額。
- 加入 AI Search 或 Browser Rendering 的受控研究來源。
- 提供整個分支的重新分類、找缺漏與觀點挑戰。
