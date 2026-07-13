"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./NodeInteraction.module.css";

const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_NOTE_CHARS = 1_800_000;
const MAX_AI_CONTEXT_CHARS = 50_000;
const AI_TIMEOUT_MS = 75_000;
const NOTE_COMMIT_DELAY_MS = 320;
const DATA_IMAGE_PATTERN = /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\)/g;

const NODE_AI_PROMPTS = [
  "整理目前筆記",
  "補充這個節點的重點",
  "改成可執行待辦",
  "改寫得更清楚",
] as const;

type Props = {
  nodeId: string;
  nodeText: string;
  note: string;
  side?: "left" | "right";
  isRoot?: boolean;
  branchContext: string[];
  aiOpen: boolean;
  variant: "popover" | "sidebar";
  onToggleAi: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onChange: (markdown: string) => void;
  onClose: () => void;
};

type NoteAiPayload = {
  data?: { markdown?: string };
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  candidate?: string;
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

function sanitizeNoteForAi(markdown: string): string {
  return markdown
    .replace(DATA_IMAGE_PATTERN, (_, alt: string) =>
      `![${alt || "貼上的圖片"}](embedded-image-omitted-from-ai-context)`,
    )
    .slice(0, MAX_AI_CONTEXT_CHARS);
}

function extractEmbeddedImages(markdown: string): string[] {
  return [...new Set(markdown.match(DATA_IMAGE_PATTERN) ?? [])];
}

function preserveEmbeddedImages(generated: string, current: string): string {
  const missing = extractEmbeddedImages(current).filter((image) => !generated.includes(image));
  if (!missing.length) return generated;
  return `${generated.trim()}\n\n## 圖片\n\n${missing.join("\n\n")}`;
}

async function readAiPayload(response: Response): Promise<NoteAiPayload> {
  const text = await response.text();
  if (!text) return { error: `AI request failed (${response.status})` };
  try {
    return JSON.parse(text) as NoteAiPayload;
  } catch {
    return { error: text.slice(0, 500) };
  }
}

export default function NodeNoteCard({
  nodeId,
  nodeText,
  note,
  branchContext,
  aiOpen,
  variant,
  onToggleAi,
  onExpand,
  onCollapse,
  onChange,
  onClose,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [draft, setDraft] = useState(note);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef(note);
  const lastSentRef = useRef(note);
  const composingRef = useRef(false);
  const chatComposingRef = useRef(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    return () => {
      requestSequenceRef.current += 1;
      abortRef.current?.abort();
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    composingRef.current = false;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    draftRef.current = note;
    lastSentRef.current = note;
    setDraft(note);
    setChatInput("");
    setChatMessages([]);
    setError("");
  }, [nodeId]);

  useEffect(() => {
    if (composingRef.current || note === lastSentRef.current) return;
    draftRef.current = note;
    lastSentRef.current = note;
    setDraft(note);
  }, [note]);

  useEffect(() => {
    if (!aiOpen) return;
    setTab("edit");
    const timer = window.setTimeout(() => chatInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [aiOpen]);

  function emitNote(next: string) {
    if (next === lastSentRef.current) return;
    lastSentRef.current = next;
    onChange(next);
  }

  function updateDraft(next: string, immediate = false) {
    if (next.length > MAX_NOTE_CHARS) {
      setError("筆記內容過大，請刪除部分圖片或文字後再試。");
      return;
    }

    setError("");
    draftRef.current = next;
    setDraft(next);
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    if (composingRef.current && !immediate) return;

    if (immediate) {
      emitNote(next);
      return;
    }

    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      emitNote(draftRef.current);
    }, NOTE_COMMIT_DELAY_MS);
  }

  function flushDraft() {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    if (!composingRef.current) emitNote(draftRef.current);
  }

  function closeEditor() {
    flushDraft();
    onClose();
  }

  function changeVariant(action: () => void) {
    flushDraft();
    action();
  }

  function insertMarkdown(before: string, after = "", placeholder = "文字") {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end) || placeholder;
    updateDraft(`${draft.slice(0, start)}${before}${selected}${after}${draft.slice(end)}`, true);
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
      const start = textarea?.selectionStart ?? draftRef.current.length;
      const end = textarea?.selectionEnd ?? draftRef.current.length;
      const markdownImages = await Promise.all(images.map(async (file, index) => {
        const dataUrl = await fileToDataUrl(file);
        const name = file.name?.replace(/[\[\]()]/g, "-") || `貼上圖片-${index + 1}`;
        return `![${name}](${dataUrl})`;
      }));
      const current = draftRef.current;
      updateDraft(`${current.slice(0, start)}\n${markdownImages.join("\n\n")}\n${current.slice(end)}`, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "圖片貼上失敗");
    }
  }

  function applyCandidate(candidate: string, mode: "replace" | "append") {
    const current = draftRef.current;
    const next = mode === "append" && current.trim()
      ? `${current.trim()}\n\n${candidate.trim()}`
      : preserveEmbeddedImages(candidate, current);
    updateDraft(next, true);
    setTab("edit");
  }

  function cancelAi() {
    requestSequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setAiLoading(false);
    setError("AI 操作已取消。");
  }

  async function sendAiMessage() {
    const userText = chatInput.trim();
    if (!userText || aiLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
    };
    const conversation = [...chatMessages, userMessage];
    setChatMessages(conversation);
    setChatInput("");

    requestSequenceRef.current += 1;
    const requestId = requestSequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let didTimeout = false;
    const timeout = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, AI_TIMEOUT_MS);

    setAiLoading(true);
    setError("");
    const history = chatMessages
      .slice(-6)
      .map((message) => `${message.role === "user" ? "使用者" : "節點助理"}：${message.content.slice(0, 1_500)}`)
      .join("\n");

    try {
      const response = await fetch("/api/ai/note/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nodeText,
          branchContext,
          content: sanitizeNoteForAi(draftRef.current.trim() || `# ${nodeText}`),
          instruction: [
            "你正在節點內和使用者對話。只能修改目前節點的 Markdown 註解，不得新增、刪除、移動或改名其他節點。",
            history ? `先前對話：\n${history}` : "",
            `使用者最新要求：${userText}`,
            "請輸出一份可直接套用到目前節點註解的 Markdown 成品。",
          ].filter(Boolean).join("\n\n"),
        }),
        signal: controller.signal,
      });
      const payload = await readAiPayload(response);
      if (requestId !== requestSequenceRef.current) return;

      const generated = payload.data?.markdown?.trim();
      if (!response.ok || !generated) {
        if (response.status === 401) throw new Error("登入已過期，請重新登入後再試。");
        throw new Error(payload.error || "AI 沒有回傳可用的 Markdown");
      }

      setChatMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "我整理了一個只影響目前節點的版本。你可以選擇追加或取代筆記。",
        candidate: generated,
      }]);
    } catch (reason) {
      if (requestId !== requestSequenceRef.current) return;
      if (controller.signal.aborted) {
        setError(didTimeout ? "AI 回應逾時，請縮短內容後再試一次。" : "AI 請求已取消。");
      } else {
        setError(reason instanceof Error ? reason.message : "AI 寫入失敗");
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestId === requestSequenceRef.current) {
        abortRef.current = null;
        setAiLoading(false);
      }
    }
  }

  const card = (
    <section
      className={`${styles.noteCard} ${variant === "sidebar" ? styles.noteSidebar : styles.notePopover} nodrag nopan nowheel`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={`${nodeText} 的 Markdown 註解`}
      aria-busy={aiLoading}
    >
      <header className={styles.noteHeader}>
        <strong title={nodeText}>註解 · {nodeText}</strong>
        <div className={styles.noteTabs}>
          <button type="button" className={tab === "edit" ? styles.activeTab : ""} onClick={() => setTab("edit")}>編輯</button>
          <button type="button" className={tab === "preview" ? styles.activeTab : ""} onClick={() => setTab("preview")}>預覽</button>
        </div>
        <div className={styles.noteHeaderActions}>
          {variant === "popover" ? (
            <button type="button" className={styles.formatButton} onClick={() => changeVariant(onExpand)}>展開</button>
          ) : (
            <button type="button" className={styles.formatButton} onClick={() => changeVariant(onCollapse)}>縮小</button>
          )}
          <button type="button" className={styles.noteClose} onClick={closeEditor} aria-label="關閉註解">×</button>
        </div>
      </header>

      {aiOpen && (
        <div className={styles.aiChat}>
          <div className={styles.aiChatHeader}>
            <div>
              <strong>節點 AI 對話</strong>
              <span>只讀「{nodeText}」與它的註解，不讀整張圖或其他節點檔案。</span>
            </div>
            <button type="button" className={styles.formatButton} onClick={onToggleAi}>收合</button>
          </div>

          <div className={styles.chatMessages}>
            {chatMessages.length === 0 && (
              <div className={styles.chatEmpty}>直接告訴 AI 想怎麼修改這個節點，例如「幫我補一段上架前檢查清單」。</div>
            )}
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`${styles.chatMessage} ${message.role === "user" ? styles.chatUser : styles.chatAssistant}`}
              >
                <div>{message.content}</div>
                {message.candidate && (
                  <div className={styles.chatCandidate}>
                    <MarkdownPreview markdown={message.candidate} />
                    <div className={styles.chatApplyActions}>
                      <button type="button" onClick={() => applyCandidate(message.candidate!, "append")}>追加到筆記</button>
                      <button type="button" onClick={() => applyCandidate(message.candidate!, "replace")}>取代筆記</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && <div className={`${styles.chatMessage} ${styles.chatAssistant}`}>正在整理目前節點…</div>}
          </div>

          <div className={styles.aiQuickPrompts}>
            {NODE_AI_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => setChatInput(prompt)}>{prompt}</button>
            ))}
          </div>

          <div className={styles.aiComposer}>
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onCompositionStart={() => { chatComposingRef.current = true; }}
              onCompositionEnd={() => { chatComposingRef.current = false; }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !chatComposingRef.current) {
                  event.preventDefault();
                  void sendAiMessage();
                }
              }}
              placeholder="和 AI 說你想如何修改目前節點…"
            />
            <div className={styles.aiComposerActions}>
              <span>Enter 送出 · Shift + Enter 換行</span>
              {aiLoading ? (
                <button type="button" className={styles.secondaryButton} onClick={cancelAi}>取消</button>
              ) : (
                <button type="button" className={styles.primaryButton} disabled={!chatInput.trim()} onClick={() => void sendAiMessage()}>送出</button>
              )}
            </div>
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
          <button type="button" className={styles.formatButton} onClick={onToggleAi}>✦ 節點 AI</button>
        </div>
      )}

      <div className={styles.noteBody}>
        {tab === "edit" ? (
          <textarea
            ref={textareaRef}
            className={styles.noteTextarea}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={(event) => {
              composingRef.current = false;
              updateDraft(event.currentTarget.value);
            }}
            onBlur={flushDraft}
            onPaste={(event) => void onPaste(event)}
            placeholder="# 節點註解\n\n支援 **Markdown**，可直接貼上圖片。"
            spellCheck
          />
        ) : <MarkdownPreview markdown={draft} />}
      </div>

      {error && <div className={styles.inlineError}>{error}</div>}
      <footer className={styles.noteFooter}>
        <span>支援 Markdown · 可貼圖片（單張 ≤ 700 KB）</span>
        <span>{draft.length.toLocaleString()} 字元</span>
      </footer>
    </section>
  );

  return mounted ? createPortal(card, document.body) : null;
}
