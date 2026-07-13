"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import styles from "./NodeInteraction.module.css";

const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_NOTE_CHARS = 1_800_000;
const AI_TIMEOUT_MS = 60_000;

type Props = {
  nodeText: string;
  note: string;
  side?: "left" | "right";
  isRoot?: boolean;
  branchContext: string[];
  aiOpen: boolean;
  onToggleAi: () => void;
  onChange: (markdown: string) => void;
  onClose: () => void;
};

type MarkdownResult = {
  data?: { normalizedMarkdown?: string };
  error?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

function safeUrl(value: string, image = false): string | null {
  const trimmed = value.trim();
  if (image && trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/")) return trimmed;
  return null;
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index));
    const key = `${keyPrefix}-${index++}`;
    if (match[1] !== undefined) {
      const src = safeUrl(match[2], true);
      result.push(src ? <img key={key} src={src} alt={match[1] || "貼上的圖片"} /> : match[0]);
    } else if (match[3] !== undefined) {
      const href = safeUrl(match[4]);
      result.push(href ? <a key={key} href={href} target="_blank" rel="noreferrer">{match[3]}</a> : match[0]);
    } else if (match[5] !== undefined) {
      result.push(<strong key={key}>{match[5]}</strong>);
    } else if (match[6] !== undefined) {
      result.push(<code key={key}>{match[6]}</code>);
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const rendered = useMemo(() => {
    const lines = markdown.split(/\r?\n/);
    const nodes: ReactNode[] = [];
    let codeLines: string[] | null = null;
    let codeStart = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim().startsWith("```")) {
        if (codeLines) {
          nodes.push(<pre key={`code-${codeStart}`}><code>{codeLines.join("\n")}</code></pre>);
          codeLines = null;
        } else {
          codeLines = [];
          codeStart = index;
        }
        continue;
      }
      if (codeLines) {
        codeLines.push(line);
        continue;
      }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const content = renderInline(heading[2], `h-${index}`);
        if (heading[1].length === 1) nodes.push(<h1 key={index}>{content}</h1>);
        else if (heading[1].length === 2) nodes.push(<h2 key={index}>{content}</h2>);
        else if (heading[1].length === 3) nodes.push(<h3 key={index}>{content}</h3>);
        else nodes.push(<h4 key={index}>{content}</h4>);
        continue;
      }

      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      if (bullet) {
        nodes.push(<div key={index}>• {renderInline(bullet[1], `li-${index}`)}</div>);
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        nodes.push(<blockquote key={index}>{renderInline(quote[1], `q-${index}`)}</blockquote>);
        continue;
      }

      nodes.push(line.trim()
        ? <p key={index}>{renderInline(line, `p-${index}`)}</p>
        : <div key={index} aria-hidden="true">&nbsp;</div>);
    }

    if (codeLines) nodes.push(<pre key={`code-${codeStart}`}><code>{codeLines.join("\n")}</code></pre>);
    return nodes;
  }, [markdown]);

  return <div className={styles.preview}>{rendered.length ? rendered : <span>尚未撰寫筆記</span>}</div>;
}

export default function NodeNoteCard({
  nodeText,
  note,
  side,
  isRoot,
  branchContext,
  aiOpen,
  onToggleAi,
  onChange,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [prompt, setPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cardPosition = isRoot
    ? styles.noteCenter
    : side === "left"
      ? styles.noteLeft
      : styles.noteRight;

  function updateNote(next: string) {
    if (next.length > MAX_NOTE_CHARS) {
      setError("筆記內容過大，請刪除部分圖片或文字後再試。");
      return;
    }
    setError("");
    onChange(next);
  }

  function insertMarkdown(before: string, after = "", placeholder = "文字") {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? note.length;
    const end = textarea?.selectionEnd ?? note.length;
    const selected = note.slice(start, end) || placeholder;
    updateNote(`${note.slice(0, start)}${before}${selected}${after}${note.slice(end)}`);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!images.length) return;
    event.preventDefault();

    const oversized = images.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError(`圖片 ${oversized.name || "clipboard-image"} 超過 700 KB，請先壓縮。`);
      return;
    }

    try {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? note.length;
      const end = textarea?.selectionEnd ?? note.length;
      const markdownImages = await Promise.all(images.map(async (file, index) => {
        const dataUrl = await fileToDataUrl(file);
        const name = file.name?.replace(/[\[\]()]/g, "-") || `貼上圖片-${index + 1}`;
        return `![${name}](${dataUrl})`;
      }));
      updateNote(`${note.slice(0, start)}\n${markdownImages.join("\n\n")}\n${note.slice(end)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "圖片貼上失敗");
    }
  }

  async function runAi(mode: "replace" | "append") {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    setAiLoading(true);
    setError("");

    try {
      const context = branchContext.length ? `上層脈絡：${branchContext.join(" > ")}。` : "";
      const instruction = [
        context,
        `目前節點：${nodeText}。`,
        prompt.trim() || "請整理成清楚、可直接使用的節點註解。",
        "請保留 Markdown 格式，內容要適合直接放進心智圖節點註解。",
      ].filter(Boolean).join("\n");
      const response = await fetch("/api/ai/markdown/organize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: note.trim() || `# ${nodeText}`, instruction, maxDepth: 4 }),
        signal: controller.signal,
      });
      const payload = await response.json() as MarkdownResult;
      const generated = payload.data?.normalizedMarkdown?.trim();
      if (!response.ok || !generated) throw new Error(payload.error || "AI 沒有回傳可用的 Markdown");
      updateNote(mode === "append" && note.trim() ? `${note.trim()}\n\n${generated}` : generated);
      setTab("edit");
    } catch (reason) {
      setError(controller.signal.aborted ? "AI 回應逾時，請縮短筆記後重試。" : reason instanceof Error ? reason.message : "AI 寫入失敗");
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
      setAiLoading(false);
    }
  }

  return (
    <section
      className={`${styles.noteCard} ${cardPosition} nodrag nopan nowheel`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={`${nodeText} 的 Markdown 註解`}
    >
      <header className={styles.noteHeader}>
        <strong title={nodeText}>註解 · {nodeText}</strong>
        <div className={styles.noteTabs}>
          <button type="button" className={tab === "edit" ? styles.activeTab : ""} onClick={() => setTab("edit")}>編輯</button>
          <button type="button" className={tab === "preview" ? styles.activeTab : ""} onClick={() => setTab("preview")}>預覽</button>
        </div>
        <button type="button" className={styles.noteClose} onClick={onClose} aria-label="收合註解">×</button>
      </header>

      {aiOpen && (
        <div className={styles.aiBox}>
          <div className={styles.aiInputRow}>
            <input
              className={styles.aiInput}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：幫我補成 Podcast 訪綱"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !aiLoading) void runAi("replace");
              }}
            />
            <button type="button" className={styles.formatButton} onClick={onToggleAi}>收合 AI</button>
          </div>
          <div className={styles.aiActions}>
            <button type="button" disabled={aiLoading} onClick={() => void runAi("replace")}>{aiLoading ? "處理中…" : "AI 整理並覆寫"}</button>
            <button type="button" disabled={aiLoading} onClick={() => void runAi("append")}>AI 追加內容</button>
          </div>
        </div>
      )}

      {tab === "edit" && (
        <div className={styles.editorTools}>
          <button type="button" className={styles.formatButton} onClick={() => insertMarkdown("**", "**", "粗體")}>B</button>
          <button type="button" className={styles.formatButton} onClick={() => insertMarkdown("## ", "", "標題")}>H2</button>
          <button type="button" className={styles.formatButton} onClick={() => insertMarkdown("- ", "", "清單項目")}>• 清單</button>
          <button type="button" className={styles.formatButton} onClick={() => insertMarkdown("`", "`", "程式碼")}>Code</button>
          <button type="button" className={styles.formatButton} onClick={() => insertMarkdown("![", "](https://)", "圖片說明")}>圖片網址</button>
          <button type="button" className={styles.formatButton} onClick={onToggleAi}>✦ AI</button>
        </div>
      )}

      <div className={styles.noteBody}>
        {tab === "edit" ? (
          <textarea
            ref={textareaRef}
            className={styles.noteTextarea}
            value={note}
            onChange={(event) => updateNote(event.target.value)}
            onPaste={(event) => void onPaste(event)}
            placeholder="# 節點註解\n\n支援 **Markdown**，可直接貼上圖片。"
            spellCheck
          />
        ) : <MarkdownPreview markdown={note} />}
      </div>

      {error && <div className={styles.inlineError}>{error}</div>}
      <footer className={styles.noteFooter}>
        <span>支援 Markdown · 可貼圖片（單張 ≤ 700 KB）</span>
        <span>{note.length.toLocaleString()} 字元</span>
      </footer>
    </section>
  );
}
