"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import type {
  OrganizeMarkdownResult,
  ResearchNodeResult,
  SplitTasksResult,
  SuggestedNode,
} from "@/lib/ai/types";
import { tasksToSuggestedNodes } from "@/lib/ai/apply-plan";

type Mode = "research" | "tasks" | "markdown";
type AiResult = ResearchNodeResult | SplitTasksResult | OrganizeMarkdownResult;

type Props = {
  nodeText: string;
  branchContext?: string[];
  onApplyNodes: (nodes: SuggestedNode[]) => Promise<void> | void;
  onClose: () => void;
};

async function readPayload(response: Response): Promise<{ data?: AiResult; error?: string }> {
  try {
    return (await response.json()) as { data?: AiResult; error?: string };
  } catch {
    return { error: `AI request failed (${response.status})` };
  }
}

export default function AiNodePanel({
  nodeText,
  branchContext = [],
  onApplyNodes,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("research");
  const [question, setQuestion] = useState("");
  const [urls, setUrls] = useState("");
  const [constraints, setConstraints] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [instruction, setInstruction] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);

  const canSubmit = useMemo(
    () => mode !== "markdown" || Boolean(markdown.trim() || file),
    [mode, markdown, file],
  );

  const applyableNodes = useMemo<SuggestedNode[]>(() => {
    if (!result) return [];
    if (mode === "research" && "suggestedNodes" in result) return result.suggestedNodes;
    if (mode === "tasks" && "tasks" in result) return tasksToSuggestedNodes(result);
    if (mode === "markdown" && "outline" in result) return result.outline;
    return [];
  }, [mode, result]);

  function changeMode(next: Mode) {
    setMode(next);
    setResult(null);
    setError("");
  }

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      let endpoint: string;
      let init: RequestInit;

      if (mode === "research") {
        endpoint = "/api/ai/node/research";
        init = {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nodeText,
            branchContext,
            question: question.trim() || undefined,
            sourceUrls: urls
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        };
      } else if (mode === "tasks") {
        endpoint = "/api/ai/node/tasks";
        init = {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nodeText,
            branchContext,
            constraints: constraints
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        };
      } else if (file) {
        endpoint = "/api/ai/markdown/organize";
        const form = new FormData();
        form.set("file", file);
        if (instruction.trim()) form.set("instruction", instruction.trim());
        init = { method: "POST", body: form };
      } else {
        endpoint = "/api/ai/markdown/organize";
        init = {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: markdown,
            instruction: instruction.trim() || undefined,
          }),
        };
      }

      const response = await fetch(endpoint, init);
      const payload = await readPayload(response);
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "AI request failed");
      }
      setResult(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  async function applyNodes() {
    if (!applyableNodes.length) return;
    setApplying(true);
    setError("");
    try {
      await onApplyNodes(applyableNodes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setApplying(false);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    if (event.target.files?.[0]) setMarkdown("");
  }

  return (
    <aside className="ai-node-panel" aria-label="Cloudflare AI 助手">
      <header className="ai-panel-header">
        <div>
          <strong>Cloudflare AI 助手</strong>
          <span title={nodeText}>{nodeText}</span>
        </div>
        <button className="button button-ghost ai-close" type="button" onClick={onClose} aria-label="關閉">
          ×
        </button>
      </header>

      <nav className="ai-tabs" aria-label="AI 功能">
        <button type="button" aria-pressed={mode === "research"} onClick={() => changeMode("research")}>找資料</button>
        <button type="button" aria-pressed={mode === "tasks"} onClick={() => changeMode("tasks")}>拆分任務</button>
        <button type="button" aria-pressed={mode === "markdown"} onClick={() => changeMode("markdown")}>整理文件</button>
      </nav>

      <div className="ai-panel-body">
        {mode === "research" && (
          <section className="ai-form-section">
            <label>
              想研究的問題
              <textarea
                rows={4}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={`補充「${nodeText}」需要知道的重點`}
              />
            </label>
            <label>
              參考網址（每行一個，最多三個）
              <textarea
                rows={4}
                value={urls}
                onChange={(event) => setUrls(event.target.value)}
                placeholder="https://developers.cloudflare.com/..."
              />
            </label>
            <small>沒有網址時會使用模型既有知識，結果會標示可能過時。</small>
          </section>
        )}

        {mode === "tasks" && (
          <section className="ai-form-section">
            <p>把目前節點拆成可執行、可驗收且有相依順序的任務。</p>
            <label>
              額外限制（每行一項）
              <textarea
                rows={5}
                value={constraints}
                onChange={(event) => setConstraints(event.target.value)}
                placeholder="必須使用 Cloudflare Workers AI\n先預覽再套用"
              />
            </label>
          </section>
        )}

        {mode === "markdown" && (
          <section className="ai-form-section">
            <label>
              整理要求
              <input
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="例如：整理成 Podcast 訪綱"
              />
            </label>
            <label>
              上傳文件（最大 10 MB）
              <input type="file" onChange={selectFile} />
            </label>
            <div className="ai-divider"><span>或貼上 Markdown／文字</span></div>
            <label>
              內容
              <textarea
                rows={12}
                value={markdown}
                onChange={(event) => {
                  setMarkdown(event.target.value);
                  if (event.target.value) setFile(null);
                }}
                placeholder="# Podcast 主題\n- 開場\n- 訪談問題"
              />
            </label>
            {file && <small>已選擇：{file.name}</small>}
          </section>
        )}

        <button className="button button-primary ai-submit" type="button" disabled={loading || !canSubmit} onClick={submit}>
          {loading ? "Cloudflare AI 處理中…" : "產生建議"}
        </button>

        {error && <div className="error-box ai-error" role="alert">{error}</div>}

        {result && (
          <section className="ai-result">
            <h3>預覽</h3>
            {"summary" in result && result.summary && <p>{result.summary}</p>}
            {"freshnessWarning" in result && result.freshnessWarning && (
              <div className="ai-warning">{result.freshnessWarning}</div>
            )}
            {"assumptions" in result && result.assumptions.length > 0 && (
              <details>
                <summary>假設</summary>
                <ul>{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
            )}
            {"warnings" in result && result.warnings.length > 0 && (
              <details>
                <summary>整理提醒</summary>
                <ul>{result.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
              </details>
            )}

            <div className="ai-node-preview">
              {applyableNodes.map((node, index) => (
                <article key={`${node.title}-${index}`}>
                  <strong>{node.title}</strong>
                  {node.note && <p>{node.note}</p>}
                  {node.children?.length ? <small>{node.children.length} 個子節點</small> : null}
                </article>
              ))}
            </div>

            {applyableNodes.length > 0 && (
              <button className="button button-primary" type="button" disabled={applying} onClick={applyNodes}>
                {applying ? "加入中…" : `加入目前節點（${applyableNodes.length} 項）`}
              </button>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
